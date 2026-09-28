import type { ActionKind, Audience } from "@/audit/types";
import {
  smartListCount,
  type CreatorSnapshot,
  type MassMessageCreateBody,
  type Promotion,
  type PromotionCreateBody,
} from "@/data/types";
import type { Approach, ApproachId } from "./approaches";

export const DAY_MS = 24 * 60 * 60 * 1000;

export type Offer = { type: "discount"; percent: number } | { type: "trial"; days: number };

/** One fix, ready to send: an optional offer, then one message. */
export interface ActionPlan {
  kind: ActionKind;
  approach: ApproachId;
  offer: Offer | null;
  /** When the offer closes. Null with no offer. */
  endsAt: string | null;
  /** Renewal only: also make the message Fanvue's automatic one for anyone who turns off auto-renew. */
  automate?: boolean;
  /** Sent with the message, so a resend never delivers it twice. */
  idempotencyKey: string;
  messageText: string;
  /** The list's size when the plan was built. The send reports the real number. */
  recipientEstimate: number;
}

/** The list each fix messages. */
export const AUDIENCE: Record<ActionKind, Audience> = {
  winback: "expired_subscribers",
  "front-door": "followers",
  renewal: "non_renewing",
};

/** What the people on each list are called: one, many. */
export const AUDIENCE_NOUN: Record<ActionKind, readonly [string, string]> = {
  winback: ["fan", "fans"],
  "front-door": ["follower", "followers"],
  renewal: ["subscriber", "subscribers"],
};

/** Who can claim a fix's offer. Renewal has none: no promotion group reaches that list. */
export const OFFER_GROUP: Partial<Record<ActionKind, Promotion["availableToGroup"]>> = {
  winback: "expired_subscribers",
  "front-door": "followers",
};

export const AUTO_RENEW_OFF_TRIGGER = "subscription_canceled" as const;

/** Offers close at the end of a day, UTC. */
export function endOfDayAfter(now: Date, days: number): string {
  const day = new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
  return `${day}T23:59:59.000Z`;
}

export function offerValue(offer: Offer | null): number | undefined {
  if (!offer) return undefined;
  return offer.type === "discount" ? offer.percent : offer.days;
}

export function buildPlan(
  approach: Approach,
  snapshot: CreatorSnapshot,
  messageText: string,
  {
    value,
    endsAt,
    automate = false,
    now = new Date(),
    idempotencyKey = crypto.randomUUID(),
  }: { value?: number; endsAt?: string; automate?: boolean; now?: Date; idempotencyKey?: string } = {},
): ActionPlan {
  const { kind, offer: choice } = approach;
  const offer: Offer | null = choice
    ? choice.type === "discount"
      ? { type: "discount", percent: value ?? choice.default }
      : { type: "trial", days: value ?? choice.default }
    : null;

  return {
    kind,
    approach: approach.id,
    offer,
    endsAt: choice ? (endsAt ?? endOfDayAfter(now, choice.openDays)) : null,
    ...(kind === "renewal" && automate && { automate: true }),
    idempotencyKey,
    messageText,
    // For followers this is an upper bound: subscribers are left out when it sends.
    recipientEstimate: smartListCount(snapshot, AUDIENCE[kind]) ?? 0,
  };
}

/** The exact request bodies a plan sends: the only place a plan becomes a Fanvue request. */
export function stepsFor(plan: ActionPlan) {
  const group = OFFER_GROUP[plan.kind];
  const promotion: PromotionCreateBody | null =
    plan.offer && group
      ? {
          availableToGroup: group,
          ...(plan.offer.type === "discount"
            ? { discountPercent: plan.offer.percent }
            : { freeTrial: true, freeTrialDays: plan.offer.days }),
          endsAt: plan.endsAt!,
          // The message does the telling.
          notifyFans: false,
        }
      : null;

  const message: MassMessageCreateBody = {
    text: plan.messageText,
    includedLists: { smartListIds: [AUDIENCE[plan.kind]] },
    // Someone already paying has nothing to gain from a new-fan offer.
    ...(plan.kind === "front-door" && { excludedLists: { smartListIds: ["subscribers"] } }),
  };

  const automation = plan.automate ? { trigger: AUTO_RENEW_OFF_TRIGGER, body: { text: plan.messageText } } : null;

  return { promotion, message, automation };
}

/** The requests, for the creator who wants to see exactly what's sent. */
export function describeRequests(plan: ActionPlan) {
  const { promotion, message, automation } = stepsFor(plan);
  return [
    ...(promotion ? [{ method: "POST", path: "/promotions", body: promotion as unknown }] : []),
    { method: "POST", path: "/chats/mass-messages", body: message },
    ...(automation ? [{ method: "PUT", path: `/chats/automated-messages/${automation.trigger}`, body: automation.body }] : []),
  ];
}

/** What Send posts. The server rebuilds the plan from it and a fresh read of Fanvue. */
export function executeBody(plan: ActionPlan, messageText: string) {
  const value = offerValue(plan.offer);
  return {
    idempotencyKey: plan.idempotencyKey,
    messageText,
    approach: plan.approach,
    ...(value !== undefined && { value }),
    ...(plan.endsAt && { endsAt: plan.endsAt }),
    ...(plan.automate && { automate: true }),
  };
}
