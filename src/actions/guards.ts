import { livePromotions } from "@/audit/rules/helpers";
import type { ActionKind, Audience } from "@/audit/types";
import type { CreatorSnapshot, MassMessageStats, Promotion } from "@/data/types";
import { formatDate } from "@/lib/format";
import { DAY_MS, OFFER_GROUP } from "./plan";

// Read from Fanvue itself, so they also see what the creator did in Fanvue directly.

const RECENT_MESSAGE_DAYS = 7;

const DELIVERED = new Set<MassMessageStats["status"]>(["SENT", "SENDING", "SCHEDULED"]);

/**
 * When this list was last messaged, within the last week. An unreadable message
 * list never blocks a fix on its own: the idempotency key still stops a repeat.
 */
export function messagedRecently(snapshot: CreatorSnapshot, list: Audience, now: Date): Date | null {
  if (!snapshot.massMessages.ok) return null;
  const since = now.getTime() - RECENT_MESSAGE_DAYS * DAY_MS;
  const times = snapshot.massMessages.data
    .filter((message) => DELIVERED.has(message.status) && message.smartListIds.includes(list))
    .flatMap((message) => {
      const at = message.publishedAt ?? message.scheduledAt ?? message.createdAt;
      return at ? [Date.parse(at)] : [];
    })
    .filter((time) => time >= since);
  return times.length ? new Date(Math.max(...times)) : null;
}

/** When a list messaged at `at` can be messaged again. */
export const messageableAgainOn = (at: Date) => new Date(at.getTime() + RECENT_MESSAGE_DAYS * DAY_MS);

export function recentMessageReason(at: Date): string {
  return `You messaged these people on ${formatDate(at.toISOString())}. This comes back on ${formatDate(messageableAgainOn(at).toISOString())}, so they are not messaged twice in a week.`;
}

/** The live offer a fix's message points at. A message is only resent while there is one. */
export function liveOfferFor(snapshot: CreatorSnapshot, kind: ActionKind, now: Date): Promotion | null {
  const group = OFFER_GROUP[kind];
  return (group && livePromotions(snapshot, now)?.find((p) => p.availableToGroup === group)) || null;
}
