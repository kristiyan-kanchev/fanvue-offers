import { audit } from "@/audit/audit";
import { tellStory } from "@/audit/story";
import type { ActionKind } from "@/audit/types";
import type { CreatorSnapshot } from "@/data/types";
import type { DescribedError } from "@/server/http";
import { liveOfferFor, messagedRecently, recentMessageReason } from "./guards";
import { messageProblem } from "./message-check";
import { AUDIENCE, type ActionPlan } from "./plan";

/**
 * Why a fix can't be sent right now, or null. The page explains most of these
 * first, but only this check counts: a request made by hand goes through it too.
 */
export function sendRefusal(
  kind: ActionKind,
  snapshot: CreatorSnapshot,
  plan: ActionPlan,
  { messageOnly, now }: { messageOnly: boolean; now: Date },
): DescribedError | null {
  const problem = messageProblem(plan.offer, plan.messageText);
  if (problem) return { code: "bad_request", message: problem, recovery: "Edit the message and send again.", status: 400 };

  const lastMessaged = messagedRecently(snapshot, AUDIENCE[kind], now);
  if (lastMessaged) return { code: "already_messaged", message: recentMessageReason(lastMessaged), status: 409 };

  if (messageOnly) {
    return liveOfferFor(snapshot, kind, now)
      ? null
      : {
          code: "offer_gone",
          message: "The offer is no longer live, so this message would point at nothing.",
          recovery: "Start the fix again.",
          status: 409,
        };
  }

  const stillNeeded = tellStory(audit(snapshot, now), snapshot, now).todo.some((card) => card.kind === kind);
  return stillNeeded
    ? null
    : { code: "already_completed", message: "This one doesn't need fixing any more.", recovery: "Go back to your overview.", status: 409 };
}
