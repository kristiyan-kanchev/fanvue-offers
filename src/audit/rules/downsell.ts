import { smartListCount, type CreatorSnapshot, type Promotion } from "@/data/types";
import { unsubscribeReasonLabel } from "@/lib/format";
import type { Rule } from "../types";
import { livePromotions, subscriptionPrice } from "./helpers";

/** Are fans who left being given a reason to come back? */

/** Below this, a win-back isn't worth sending. */
const MIN_LAPSED = 20;
const MANY_LAPSED = 100;

const WINBACK_GROUPS = new Set<Promotion["availableToGroup"]>(["expired_subscribers", "all"]);

/** The top exit-survey reason over Fanvue's rolling 12 weeks: one week is too few answers to act on. */
export function topUnsubscribeReason(snapshot: CreatorSnapshot) {
  if (!snapshot.unsubscribeReasons.ok) return null;
  const { reasons, rollingTotal } = snapshot.unsubscribeReasons.data;
  const top = reasons.toSorted((a, b) => b.rollingCount - a.rollingCount)[0];
  if (!top || rollingTotal <= 0) return null;
  return { reason: top.reason, label: unsubscribeReasonLabel(top.reason), share: top.rollingCount / rollingTotal };
}

export const downsellNoWinback: Rule = (snapshot, now) => {
  const id = "downsell.no-winback";
  const lapsed = smartListCount(snapshot, "expired_subscribers");
  const promotions = livePromotions(snapshot, now);
  if (lapsed === null || promotions === null) return { id, severity: "unavailable" };

  const offerLive = promotions.some((promotion) => WINBACK_GROUPS.has(promotion.availableToGroup));
  if (lapsed < MIN_LAPSED || offerLive) return { id, severity: "ok" };

  // What the list is worth a month orders this fix against others. It's never
  // shown as a total, which would assume every one of them comes back.
  const cents = subscriptionPrice(snapshot);
  return {
    id,
    severity: lapsed >= MANY_LAPSED ? "high" : "medium",
    action: { kind: "winback", recipients: lapsed },
    ...(cents && { monthlyAtStake: lapsed * cents }),
  };
};
