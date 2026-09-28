import { liveOfferFor, messageableAgainOn, messagedRecently } from "@/actions/guards";
import { AUDIENCE, AUTO_RENEW_OFF_TRIGGER } from "@/actions/plan";
import { smartListCount, type CreatorSnapshot, type SmartListId } from "@/data/types";
import { formatCount, formatDate, formatMoney, formatPrice } from "@/lib/format";
import { subscriptionPrice } from "./rules/helpers";
import { rankActions } from "./audit";
import { topUnsubscribeReason } from "./rules/downsell";
import type { ActionKind, AuditReport, Finding, FindingId } from "./types";

// The audit in a creator's words: one card per thing the app can fix. The rules decide; this only says it.

export type CardState = "todo" | "sent" | "waiting" | "done" | "auto" | "fine" | "unknown";

export interface FixCard {
  kind: ActionKind;
  state: CardState;
  /** One line a creator understands without context. */
  title: string;
  /** Why it matters, in a sentence or two. */
  why: string;
  /** What the fix does, when there is one to do. */
  plan?: string;
  /** What each person is worth, when the price is known. */
  worth?: string;
  /** For a fix that is done or sent: how it is going. */
  status?: string;
  /** How many people the fix messages. */
  people?: number;
}

export interface Story {
  todo: FixCard[];
  inProgress: FixCard[];
  fine: FixCard[];
  unknown: FixCard[];
}

const FINDINGS: Record<ActionKind, FindingId[]> = {
  winback: ["downsell.no-winback"],
  "front-door": ["attraction.no-front-door"],
  renewal: ["continuity.auto-renew-off", "continuity.churn-rising"],
};

const TOPIC: Record<ActionKind, string> = {
  winback: "Fans who left",
  "front-door": "Followers who don't subscribe",
  renewal: "Subscribers set to leave",
};

function todoCard(kind: ActionKind, finding: Finding, snapshot: CreatorSnapshot): FixCard {
  const people = finding.action!.recipients;
  const n = formatCount(people);
  const cents = subscriptionPrice(snapshot);

  switch (kind) {
    case "winback": {
      const reason = topUnsubscribeReason(snapshot);
      return {
        kind,
        state: "todo",
        people,
        title: people === 1 ? "1 fan who used to pay you has left" : `${n} fans who used to pay you have left`,
        why:
          "They liked your content enough to pay once, but nothing is inviting them back." +
          (reason
            ? ` The most common reason fans gave for leaving was ${reason.label} (${Math.round(reason.share * 100)}%).`
            : ""),
        plan: "A discount to come back, a free week back, or just a personal invite.",
        ...(cents ? { worth: `Every fan who comes back is ${formatPrice(cents)} a month.` } : {}),
      };
    }
    case "front-door":
      return {
        kind,
        state: "todo",
        people,
        title:
          people === 1
            ? "1 person follows you but doesn't subscribe"
            : `${n} people follow you but don't subscribe`,
        why: "They're interested, but paying is a big first step, and right now there's no free trial to help them try you out.",
        plan: "A free trial, money off the first month, or just a personal invite.",
        ...(cents ? { worth: `Every follower who subscribes is ${formatPrice(cents)} a month.` } : {}),
      };
    case "renewal": {
      const churn = churnLine(snapshot);
      const autoRenewFires = finding.id === "continuity.auto-renew-off";
      return {
        kind,
        state: "todo",
        people,
        title: !autoRenewFires
          ? "More subscribers are leaving than a month ago"
          : people === 1
            ? "1 subscriber is set to leave"
            : `${n} subscribers are set to leave`,
        why:
          (people === 1
            ? "1 subscriber has turned off auto-renew, so their subscription ends when this month does unless they switch it back on."
            : `${n} subscribers have turned off auto-renew, so their subscription ends when this month does unless they switch it back on.`) +
          (churn ? ` ${churn}` : ""),
        plan: "A friendly reminder, or a note about what's coming next month. Fanvue doesn't let apps switch auto-renew back on, so asking is the fix.",
        ...(cents ? { worth: `That's about ${formatMoney(people * cents)} a month if none of them renew.` } : {}),
      };
    }
  }
}

/** Last week's lost revenue against four weeks before, when it has grown. */
function churnLine(snapshot: CreatorSnapshot): string | null {
  if (!snapshot.retention.ok) return null;
  const [latest, , , , earlier] = snapshot.retention.data;
  if (!latest || !earlier || latest.revenueLost <= earlier.revenueLost) return null;
  return `You lost ${formatMoney(latest.revenueLost)} to cancellations last week, up from ${formatMoney(earlier.revenueLost)} a month ago.`;
}

function sentCard(kind: ActionKind, at: Date): FixCard {
  const again = messageableAgainOn(at).toISOString();
  return {
    kind,
    state: "sent",
    title: `${TOPIC[kind]}: message sent`,
    why: "",
    status: `Sent ${formatDate(at.toISOString())}. Back on ${formatDate(again)} if it still needs doing, so nobody gets two in a week.`,
  };
}

function trialCard(kind: ActionKind, snapshot: CreatorSnapshot, from: string): FixCard {
  const onTrial = smartListCount(snapshot, "free_trial_subscribers") ?? 0;
  return {
    kind,
    state: "waiting",
    title: `${onTrial === 1 ? "Your trial fan gets" : "Your trial fans get"} a reminder on ${formatDate(from)}`,
    why: "",
    status: `${onTrial === 1 ? "1 fan on a free trial has" : `${formatCount(onTrial)} fans on a free trial have`} auto-renew off. The reminder waits until just before the trial ends, when it lands best.`,
  };
}

function doneCard(kind: ActionKind, snapshot: CreatorSnapshot, now: Date): FixCard | null {
  const offer = liveOfferFor(snapshot, kind, now);
  if (!offer) return null;
  const until = offer.endsAt ? ` until ${formatDate(offer.endsAt)}` : "";
  const used = offer.usedCount;
  const trial = offer.type === "free_trial";
  const what = trial
    ? `${offer.freeTrialDays ? `${offer.freeTrialDays} days free` : "A free trial"}`
    : `${offer.discountPercent ?? 0}% off ${kind === "winback" ? "their next month" : "the first month"}`;
  const who =
    kind === "winback"
      ? ["fan has come back with it", "fans have come back with it"]
      : ["person has taken it up", "people have taken it up"];
  return {
    kind,
    state: "done",
    title:
      kind === "winback"
        ? trial ? "Your free week back is live" : "Your comeback offer is live"
        : trial ? "Your free trial is live" : "Your first-month discount is live",
    why: "",
    status: `${what}${until}. ${
      used === 0 ? "Nobody has used it yet." : `${formatCount(used)} ${used === 1 ? who[0] : who[1]}.`
    }`,
  };
}

/** Whether Fanvue sends the creator's message whenever someone turns off auto-renew. */
export function automaticReminderOn(snapshot: CreatorSnapshot): boolean {
  return (
    snapshot.automatedMessages.ok &&
    snapshot.automatedMessages.data.some((m) => m.trigger === AUTO_RENEW_OFF_TRIGGER && m.enabled)
  );
}

/** The list each topic is about. With nobody on it there's nothing to say. */
const LIST: Record<ActionKind, SmartListId> = {
  winback: "expired_subscribers",
  "front-door": "followers",
  renewal: "subscribers",
};

function fineCard(kind: ActionKind, snapshot: CreatorSnapshot): FixCard | null {
  if (!smartListCount(snapshot, LIST[kind])) return null;
  const title: Record<ActionKind, string> = {
    winback: `Fans who left: ${formatCount(smartListCount(snapshot, "expired_subscribers") ?? 0)}, too few to be worth a campaign.`,
    "front-door": "Followers: nothing to do right now.",
    renewal: "Renewals: most of your subscribers renew automatically.",
  };
  return { kind, state: "fine", title: title[kind], why: "" };
}

export function tellStory(report: AuditReport, snapshot: CreatorSnapshot, now: Date = new Date()): Story {
  const byId = new Map(report.findings.map((f) => [f.id, f]));
  // The audit's own order: worst first, then most money at stake.
  const order = rankActions(report.findings).map((f) => f.action!.kind);

  const story: Story = {
    todo: [],
    inProgress: [],
    fine: [],
    unknown: [],
  };

  for (const kind of ["winback", "front-door", "renewal"] as const) {
    const findings = FINDINGS[kind].map((id) => byId.get(id)).filter((f): f is Finding => !!f);
    const actionable = findings.find((f) => f.action);
    if (actionable) {
      story.todo.push(todoCard(kind, actionable, snapshot));
      continue;
    }
    const held = findings.some((f) => f.heldBy === "recent-message");
    const at = held ? messagedRecently(snapshot, AUDIENCE[kind], now) : null;
    if (at) {
      story.inProgress.push(sentCard(kind, at));
      continue;
    }
    const trial = findings.find((f) => f.heldBy === "trial");
    if (trial?.heldUntil) {
      story.inProgress.push(trialCard(kind, snapshot, trial.heldUntil));
      continue;
    }
    const done = doneCard(kind, snapshot, now);
    if (done) {
      story.inProgress.push(done);
      continue;
    }
    if (findings.some((f) => f.severity === "unavailable")) {
      story.unknown.push({ kind, state: "unknown", title: `${TOPIC[kind]}: we couldn't read this from Fanvue.`, why: "" });
      continue;
    }
    const fine = fineCard(kind, snapshot);
    if (fine) story.fine.push(fine);
  }

  story.todo.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  if (automaticReminderOn(snapshot)) {
    story.inProgress.push({
      kind: "renewal",
      state: "auto",
      title: "Your automatic reminder is on",
      why: "",
      status: "Anyone who turns off auto-renew gets it straight away.",
    });
  }

  return story;
}
