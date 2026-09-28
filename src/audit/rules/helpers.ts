import { DAY_MS } from "@/actions/plan";
import type { CreatorSnapshot, FreeTrialLink, Promotion } from "@/data/types";

/** USD cents, or null when unknown. Zero counts as unknown: it would read as "nothing at stake". */
export function subscriptionPrice(snapshot: CreatorSnapshot): number | null {
  const price = snapshot.creator.subscriptionPrice;
  return price && price > 0 ? price : null;
}

function stillOpen(endsAt: string | null | undefined, usedCount: number, maxUsages: number | null | undefined, now: Date) {
  const ended = endsAt ? Date.parse(endsAt) <= now.getTime() : false;
  const usedUp = typeof maxUsages === "number" && usedCount >= maxUsages;
  return !ended && !usedUp;
}

export const isPromotionLive = (promotion: Promotion, now: Date) =>
  stillOpen(promotion.endsAt, promotion.usedCount, promotion.maxUsages, now);

export const isTrialLinkLive = (link: FreeTrialLink, now: Date) =>
  stillOpen(link.expiresAt, link.usedCount, link.maxUsages, now);

/** Null when promotions couldn't be read. */
export function livePromotions(snapshot: CreatorSnapshot, now: Date): Promotion[] | null {
  return snapshot.promotions.ok ? snapshot.promotions.data.filter((p) => isPromotionLive(p, now)) : null;
}

/**
 * The soonest a free trial running now can end. Fanvue doesn't say when each fan
 * started, so a trial is assumed to start no earlier than its offer was made.
 * Null when nobody has taken a trial offer.
 */
export function firstTrialEnd(snapshot: CreatorSnapshot, now: Date): Date | null {
  const offers = [
    ...(snapshot.promotions.ok ? snapshot.promotions.data : []).map((p) => ({ ...p, days: p.freeTrialDays })),
    ...(snapshot.freeTrialLinks.ok ? snapshot.freeTrialLinks.data : []).map((l) => ({ ...l, days: l.trialDurationDays })),
  ];
  const ends = offers.flatMap(({ days, createdAt, usedCount }) => {
    const made = Date.parse(createdAt);
    if (!days || usedCount === 0 || Number.isNaN(made)) return [];
    const length = days * DAY_MS;
    return [Math.max(made, now.getTime() - length) + length];
  });
  return ends.length ? new Date(Math.min(...ends)) : null;
}
