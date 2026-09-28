import { describe, expect, it } from "vitest";
import type { MassMessageCreateBody, PromotionCreateBody } from "@/data/types";
import { mayaSnapshot } from "@/test/helpers";
import { APPROACHES } from "./approaches";
import { buildPlan, stepsFor, type ActionPlan } from "./plan";

/**
 * The generated types already reject a wrong field, list id or group at compile
 * time. These are the rules Fanvue states only in prose in its OpenAPI
 * descriptions, so no type can carry them:
 *
 * - POST /promotions: "either a first-month discount or a free trial, never
 *   both"; freeTrialDays 1-30; discountPercent 1-100.
 * - POST /chats/mass-messages: at least one list, and something to say.
 */

const NOW = new Date("2026-09-23T10:00:00.000Z");

function promotionViolations(body: PromotionCreateBody, now: Date): string[] {
  const problems: string[] = [];
  const isTrial = body.freeTrial === true || body.freeTrialDays !== undefined;
  const isDiscount = body.discountPercent !== undefined;
  if (isTrial === isDiscount) problems.push("must be a discount or a free trial, not both or neither");
  if (isDiscount && (body.discountPercent! < 1 || body.discountPercent! > 100)) {
    problems.push("discountPercent outside 1-100");
  }
  if (body.freeTrialDays !== undefined && (body.freeTrialDays < 1 || body.freeTrialDays > 30)) {
    problems.push("freeTrialDays outside 1-30");
  }
  if (body.endsAt !== undefined && !(Date.parse(body.endsAt) > now.getTime())) {
    problems.push("endsAt is not a future ISO date");
  }
  return problems;
}

function messageViolations(body: MassMessageCreateBody): string[] {
  const problems: string[] = [];
  if (!body.includedLists.smartListIds?.length && !body.includedLists.customListUuids?.length) {
    problems.push("no list to send to");
  }
  if (!body.text?.trim() && !body.mediaUuids?.length) problems.push("empty message");
  const included = new Set(body.includedLists.smartListIds ?? []);
  for (const id of body.excludedLists?.smartListIds ?? []) {
    if (included.has(id)) problems.push(`list ${id} is both included and excluded`);
  }
  return problems;
}

/** Every approach, at every offer a creator can pick. */
async function everyPlan(): Promise<ActionPlan[]> {
  const snapshot = await mayaSnapshot();
  return Object.values(APPROACHES)
    .flat()
    .flatMap((approach) =>
      (approach.offer ? approach.offer.choices : [undefined]).map((value) =>
        buildPlan(approach, snapshot, "Hi.", { now: NOW, idempotencyKey: "k", ...(value ? { value } : {}) }),
      ),
    );
}

describe("every request body keeps Fanvue's written rules", () => {
  it("holds for every approach, at every offer a creator can pick", async () => {
    const plans = await everyPlan();
    expect(plans).toHaveLength(19);
    for (const plan of plans) {
      const steps = stepsFor(plan);
      const label = `${plan.kind} ${JSON.stringify(steps)}`;
      if (steps.promotion) expect(promotionViolations(steps.promotion, NOW), label).toEqual([]);
      expect(messageViolations(steps.message), label).toEqual([]);
    }
  });

  it("catches the mistakes it is there to catch", () => {
    expect(
      promotionViolations(
        { availableToGroup: "followers", discountPercent: 40, freeTrialDays: 7 },
        NOW,
      ),
    ).toContain("must be a discount or a free trial, not both or neither");
    expect(messageViolations({ text: " ", includedLists: {} })).toEqual([
      "no list to send to",
      "empty message",
    ]);
  });
});
