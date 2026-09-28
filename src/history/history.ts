import { offerLabel, type ApproachId } from "@/actions/approaches";
import { AUDIENCE_NOUN, offerValue, type Offer } from "@/actions/plan";
import type { ActionKind } from "@/audit/types";
import type { CreatorSnapshot } from "@/data/types";
import { formatCount, formatDate, formatPeople, formatPrice } from "@/lib/format";

/**
 * A fix sent through the app: what was done, never the message text or anything
 * about a fan. Fanvue stops listing an offer once it ends, so the last count
 * seen is kept.
 */
export interface HistoryEntry {
  /** Fanvue's mass message uuid, or a demo id. */
  id: string;
  kind: ActionKind;
  approach: ApproachId;
  sentAt: string;
  recipients: number;
  offer: Offer | null;
  endsAt: string | null;
  promotionUuid: string | null;
  /** Monthly price when it was sent, in USD cents, to put a number on the result. */
  price: number | null;
  /** Whether the message also became the automatic auto-renew reminder. */
  automated: boolean;
  /** Redemptions last seen on Fanvue. Null until the first look. */
  used: number | null;
}

export interface HistoryRow {
  id: string;
  kind: ActionKind;
  sentAt: string;
  /** What was done, with the offer: "Invited fans who left to come back: 40% off". */
  title: string;
  /** The result, in a line: "12 fans came back", or "Nobody's used it yet". */
  result: string;
  /** The small print, in one short line: "To 178 fans · US$71.88 so far · Open until 9 Oct". */
  note: string | null;
  status: "live" | "ended" | "sent";
  /** Money the offer has brought in so far, in cents. Null when it can't be known. */
  earned: number | null;
  /** People who took the offer. Null for a message with no offer. */
  took: number | null;
}

const TITLE: Record<ActionKind, string> = {
  winback: "Invited fans who left to come back",
  "front-door": "Invited followers to subscribe",
  renewal: "Reminded subscribers auto-renew is off",
};

function tookLine(kind: ActionKind, offer: Offer, took: number): string {
  if (kind === "winback") return `${formatPeople(took, "fan", "fans")} came back`;
  if (offer.type === "trial") return `${formatCount(took)} started a free trial`;
  return formatPeople(took, "new subscriber", "new subscribers");
}

/** From Fanvue's count while it still lists the offer, and the last count seen once it doesn't. */
export function historyRow(entry: HistoryEntry, snapshot: CreatorSnapshot, now: Date): HistoryRow {
  const offer = entry.offer ? offerLabel(entry.offer.type, offerValue(entry.offer)!) : null;
  const people = formatPeople(entry.recipients, ...AUDIENCE_NOUN[entry.kind]);
  const base = {
    id: entry.id,
    kind: entry.kind,
    sentAt: entry.sentAt,
    title: offer ? `${TITLE[entry.kind]}: ${offer}` : TITLE[entry.kind],
  };

  if (!entry.offer) {
    return {
      ...base,
      result: `Sent to ${people}`,
      note: entry.automated ? "Now also sent automatically" : null,
      status: "sent",
      earned: null,
      took: null,
    };
  }

  const listed =
    entry.promotionUuid && snapshot.promotions.ok
      ? snapshot.promotions.data.find((p) => p.uuid === entry.promotionUuid)
      : undefined;
  const took = listed?.usedCount ?? entry.used ?? 0;
  const endsAt = listed?.endsAt ?? entry.endsAt;
  const live = Boolean(listed) && (!endsAt || Date.parse(endsAt) > now.getTime());
  const until = endsAt ? formatDate(endsAt) : null;

  // A discount is money in: each fan who took it paid the discounted month.
  // A free trial is not, yet: it's worth the full price only if they stay.
  let earned: number | null = null;
  let worth: string | null = null;
  if (entry.price !== null && took > 0) {
    if (entry.offer.type === "discount") {
      earned = took * Math.round(entry.price * (1 - entry.offer.percent / 100));
    } else {
      worth = `Worth ${formatPrice(took * entry.price)}/mo if they stay`;
    }
  }

  const result = took > 0 ? tookLine(entry.kind, entry.offer, took) : live ? "Nobody's used it yet" : "Nobody used it";

  const parts = [
    `To ${people}`,
    earned !== null ? `${formatPrice(earned)} so far` : null,
    worth,
    live ? (until ? `Open until ${until}` : "Still open") : null,
  ];

  return {
    ...base,
    result,
    note: parts.filter(Boolean).join(" · "),
    status: live ? "live" : "ended",
    earned,
    took,
  };
}

export interface HistoryTotals {
  earned: number;
  took: number;
  sent: number;
}

export function historyTotals(rows: HistoryRow[]): HistoryTotals {
  return {
    earned: rows.reduce((sum, row) => sum + (row.earned ?? 0), 0),
    took: rows.reduce((sum, row) => sum + (row.took ?? 0), 0),
    sent: rows.length,
  };
}

/** Newest first. */
export function historyRows(entries: HistoryEntry[], snapshot: CreatorSnapshot, now: Date): HistoryRow[] {
  return [...entries]
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
    .map((entry) => historyRow(entry, snapshot, now));
}

/**
 * Entries whose offer Fanvue still lists with a new count: the count to keep,
 * so the result survives the offer ending.
 */
export function usageUpdates(entries: HistoryEntry[], snapshot: CreatorSnapshot): HistoryEntry[] {
  if (!snapshot.promotions.ok) return [];
  const promotions = snapshot.promotions.data;
  return entries.flatMap((entry) => {
    const listed = entry.promotionUuid ? promotions.find((p) => p.uuid === entry.promotionUuid) : undefined;
    return listed && listed.usedCount !== entry.used ? [{ ...entry, used: listed.usedCount }] : [];
  });
}
