import "server-only";

import { z } from "zod";
import { topUnsubscribeReason } from "@/audit/rules/downsell";
import type { ActionKind } from "@/audit/types";
import type { CreatorSnapshot } from "@/data/types";
import { approachFor, offerValueAllowed, recommendedApproach, type Approach } from "./approaches";
import type { DraftBudget } from "./draft-budget";
import { creatorVoice, draftMessage, type DraftResult } from "./draft-message";
import { buildPlan, DAY_MS, endOfDayAfter, type ActionPlan } from "./plan";

/** Opening a fix, switching approach, or asking for another version. */
export const PLAN_BODY = z.object({
  idempotencyKey: z.string().min(1).max(255).optional(),
  approach: z.string().optional(),
  value: z.number().int().optional(),
});

/** What Send posts. Anything else is ignored. */
const EXECUTE_BODY = z.object({
  idempotencyKey: z.string().min(1).max(255),
  messageText: z.string().trim().min(1).max(5000),
  approach: z.string(),
  value: z.number().int().optional(),
  endsAt: z.iso.datetime().refine((value) => Date.parse(value) > Date.now(), "The end date has passed").optional(),
  automate: z.boolean().optional(),
});

/** The approach asked for, or the one the data suggests. */
function pickApproach(kind: ActionKind, snapshot: CreatorSnapshot, requested?: string): Approach | null {
  if (requested !== undefined) return approachFor(kind, requested);
  const reason = topUnsubscribeReason(snapshot);
  // No exit survey data is "unknown", which isn't the same as "not over price".
  return recommendedApproach(kind, reason ? { leftOverPrice: reason.reason === "too_expensive" } : {});
}

/** A plan with its message drafted. Null for an approach or value this fix doesn't offer. */
export async function preparePlan(
  kind: ActionKind,
  snapshot: CreatorSnapshot,
  body: z.infer<typeof PLAN_BODY>,
  { budget, reuse = false }: { budget: DraftBudget; reuse?: boolean },
): Promise<{ plan: ActionPlan; draft: DraftResult } | null> {
  const approach = pickApproach(kind, snapshot, body.approach);
  if (!approach || (body.value !== undefined && !offerValueAllowed(approach, body.value))) return null;

  // Built first without text, to learn the offer and date the message should mention.
  const plan = buildPlan(approach, snapshot, "", { value: body.value, idempotencyKey: body.idempotencyKey });
  const draft = await draftMessage(
    {
      approach: approach.id,
      ...creatorVoice(snapshot),
      recipientCount: plan.recipientEstimate,
      offer: plan.offer,
      endsAt: plan.endsAt,
      topUnsubscribeReason: kind === "winback" ? (topUnsubscribeReason(snapshot)?.label ?? null) : null,
    },
    { budget, reuse },
  );
  return { plan: { ...plan, messageText: draft.text }, draft };
}

/**
 * The plan from what the creator confirmed. Who gets the message comes from
 * the snapshot, never the browser, and the offer must be one the page offers,
 * closing no later than the approach allows.
 */
export function planFromEdits(kind: ActionKind, snapshot: CreatorSnapshot, raw: unknown): ActionPlan | null {
  const edits = EXECUTE_BODY.safeParse(raw);
  if (!edits.success) return null;
  const { idempotencyKey, messageText, value, endsAt, automate } = edits.data;

  const approach = approachFor(kind, edits.data.approach);
  if (!approach) return null;
  if (approach.offer) {
    if (!offerValueAllowed(approach, value) || !endsAt) return null;
    const latest = Date.parse(endOfDayAfter(new Date(), approach.offer.openDays)) + DAY_MS;
    if (Date.parse(endsAt) > latest) return null;
  }

  return buildPlan(approach, snapshot, messageText, {
    idempotencyKey,
    automate,
    ...(approach.offer && { value, endsAt }),
  });
}
