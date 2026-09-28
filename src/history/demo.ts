import { APPROACHES } from "@/actions/approaches";
import { DAY_MS } from "@/actions/plan";
import type { CreatorSnapshot, DemoPersona, DemoSend } from "@/data/types";
import type { HistoryEntry } from "./history";

/**
 * Maya's past fixes, so History has a result to show the first time the
 * demo opens: a comeback offer that has ended, and a reminder with no offer.
 * Dated from today, so they never go stale.
 */
function mayaPast(price: number | null, now: Date): HistoryEntry[] {
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  return [
    {
      id: "demo-past-winback",
      kind: "winback",
      approach: "comeback-discount",
      sentAt: daysAgo(63),
      recipients: 212,
      offer: { type: "discount", percent: 30 },
      endsAt: daysAgo(56),
      promotionUuid: "demo-past-winback-offer",
      price,
      automated: false,
      used: 17,
    },
    {
      id: "demo-past-renewal",
      kind: "renewal",
      approach: "friendly-reminder",
      sentAt: daysAgo(35),
      recipients: 301,
      offer: null,
      endsAt: null,
      promotionUuid: null,
      price,
      automated: false,
      used: null,
    },
  ];
}

/**
 * The demo's history: the persona's past, and every dry run from this session,
 * with the same ids the fixture overlay gives their offers and messages.
 */
export function demoHistory(
  persona: DemoPersona,
  sent: DemoSend[],
  snapshot: CreatorSnapshot,
  now: Date,
): HistoryEntry[] {
  const price = snapshot.creator.subscriptionPrice;
  const past = persona === "maya" ? mayaPast(price, now) : [];
  const fromSession = sent.map(
    (send): HistoryEntry => ({
      id: `demo-message-${send.kind}-${send.at}`,
      kind: send.kind,
      approach: send.approach ?? APPROACHES[send.kind][0]!.id,
      sentAt: send.at,
      recipients: send.recipients,
      offer: send.offer,
      endsAt: send.endsAt,
      promotionUuid: send.offer && send.kind !== "renewal" ? `demo-${send.kind}-${send.at}` : null,
      price,
      automated: Boolean(send.automatedText),
      used: send.offer ? 0 : null,
    }),
  );
  return [...past, ...fromSession];
}
