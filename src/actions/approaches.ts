import type { ActionKind } from "@/audit/types";

// The ways to fix each problem: an optional offer (a discount or a free trial)
// and one message whose angle is the approach. Some differ only in wording,
// because the wording is often the whole difference.

export type ApproachId =
  | "comeback-discount"
  | "free-week-back"
  | "just-ask"
  | "free-trial"
  | "first-month-off"
  | "personal-invite"
  | "friendly-reminder"
  | "whats-coming";

type OfferType = "discount" | "trial";

export interface OfferChoice {
  type: OfferType;
  /** Percent off for a discount, days free for a trial. */
  choices: number[];
  default: number;
  /** How long fans have to claim it. */
  openDays: number;
}

export interface Approach {
  id: ApproachId;
  kind: ActionKind;
  label: string;
  /** What it does, in one line. */
  pitch: string;
  /** When a creator should pick it. */
  bestWhen: string;
  offer: OfferChoice | null;
}

export const APPROACHES: Record<ActionKind, Approach[]> = {
  winback: [
    {
      id: "comeback-discount",
      kind: "winback",
      label: "A discount to come back",
      pitch: "Money off their next month, and a message inviting them back.",
      bestWhen: "Best when they left over price.",
      offer: { type: "discount", choices: [20, 30, 40, 50], default: 40, openDays: 7 },
    },
    {
      id: "free-week-back",
      kind: "winback",
      label: "A free week back",
      pitch: "A few days free to see what they've missed, and a message about it.",
      bestWhen: "Best when you post a lot and want them to see it before paying again.",
      offer: { type: "trial", choices: [3, 7, 14], default: 7, openDays: 7 },
    },
    {
      id: "just-ask",
      kind: "winback",
      label: "Just invite them back",
      pitch: "A personal message, no discount. You add one line about what's new.",
      bestWhen: "Best when you don't want to lower your price.",
      offer: null,
    },
  ],
  "front-door": [
    {
      id: "free-trial",
      kind: "front-door",
      label: "A free trial",
      pitch: "A few days free so they can try you, and a message about it.",
      bestWhen: "Best for most creators: trying is easier than paying.",
      offer: { type: "trial", choices: [3, 7, 14, 30], default: 7, openDays: 14 },
    },
    {
      id: "first-month-off",
      kind: "front-door",
      label: "Money off the first month",
      pitch: "A discount on their first month, and a message about it.",
      bestWhen: "Best when you'd rather they pay something from day one.",
      offer: { type: "discount", choices: [20, 30, 40, 50], default: 30, openDays: 14 },
    },
    {
      id: "personal-invite",
      kind: "front-door",
      label: "A personal invite",
      pitch: "A message from you asking them to subscribe, no offer.",
      bestWhen: "Best when your followers already know and like you.",
      offer: null,
    },
  ],
  renewal: [
    {
      id: "friendly-reminder",
      kind: "renewal",
      label: "A friendly reminder",
      pitch: "Tell them auto-renew is off, and how to turn it back on.",
      bestWhen: "Best for most creators: some switched it off without meaning to.",
      offer: null,
    },
    {
      id: "whats-coming",
      kind: "renewal",
      label: "Tell them what's coming",
      pitch: "Give them a reason to stay. You add one line about next month.",
      bestWhen: "Best when you have something planned they won't want to miss.",
      offer: null,
    },
  ],
};

const BY_ID = new Map(Object.values(APPROACHES).flat().map((a) => [a.id, a]));

export function approachFor(kind: ActionKind, id: unknown): Approach | null {
  const approach = typeof id === "string" ? BY_ID.get(id as ApproachId) : undefined;
  return approach && approach.kind === kind ? approach : null;
}

/**
 * The first in the list, except for fans who left for a reason other than
 * price: a free week back shows them what they're missing without a discount.
 */
export function recommendedApproach(kind: ActionKind, hints: { leftOverPrice?: boolean } = {}): Approach {
  if (kind === "winback" && hints.leftOverPrice === false) return BY_ID.get("free-week-back")!;
  return APPROACHES[kind][0]!;
}

/** Whether an offer value is one this approach allows. The server checks this too. */
export function offerValueAllowed(approach: Approach, value: unknown): value is number {
  if (!approach.offer) return value === undefined || value === null;
  // Only the values the page offers: a request made by hand can't ask for 100% off.
  return typeof value === "number" && approach.offer.choices.includes(value);
}

/** "40% off" or "7 days free". */
export function offerLabel(type: OfferType, value: number): string {
  return type === "discount" ? `${value}% off` : `${value} days free`;
}

/** A gap only the creator can fill, like "[what's coming next month]". Send waits until it's filled. */
export const PLACEHOLDER = /\[[^\]]+\]/;
