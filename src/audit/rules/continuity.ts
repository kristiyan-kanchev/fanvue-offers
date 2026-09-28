import { DAY_MS } from "@/actions/plan";
import { smartListCount, type CreatorSnapshot } from "@/data/types";
import type { Rule } from "../types";
import { firstTrialEnd, subscriptionPrice } from "./helpers";

/** Are subscribers about to lapse, and is churn rising? */

/** Share of subscribers with auto-renew off above which renewals are leaking. */
const AUTO_RENEW_OFF_SHARE = 0.2;
/** A rise in weekly churn of two percentage points counts as rising. */
const CHURN_RISE = 0.02;
const CHURN_LOOKBACK_WEEKS = 4;
/** A reminder to stay lands best a few days before a trial ends, not the day it starts. */
const REMIND_BEFORE_TRIAL_ENDS_DAYS = 3;

// Both are fixed by the same message: the people with auto-renew off are the
// ones churn takes next. The audit gives the fix to whichever fires first.

const leaking = (nonRenewing: number, subscribers: number) => nonRenewing / subscribers > AUTO_RENEW_OFF_SHARE;

/**
 * When the people set to leave are mostly fans on a free trial, the reminder
 * waits until a few days before the first trial ends. Null when it needn't wait.
 */
function trialReminderFrom(snapshot: CreatorSnapshot, nonRenewing: number, subscribers: number, now: Date): Date | null {
  const onTrial = smartListCount(snapshot, "free_trial_subscribers") ?? 0;
  if (onTrial === 0 || leaking(nonRenewing - onTrial, subscribers)) return null;
  const end = firstTrialEnd(snapshot, now);
  const from = end && new Date(end.getTime() - REMIND_BEFORE_TRIAL_ENDS_DAYS * DAY_MS);
  return from && from > now ? from : null;
}

export const continuityAutoRenewOff: Rule = (snapshot, now) => {
  const id = "continuity.auto-renew-off";
  const subscribers = smartListCount(snapshot, "subscribers");
  const nonRenewing = smartListCount(snapshot, "non_renewing");
  if (subscribers === null || nonRenewing === null) return { id, severity: "unavailable" };
  if (subscribers === 0 || !leaking(nonRenewing, subscribers)) return { id, severity: "ok" };

  const cents = subscriptionPrice(snapshot);
  // Money that really does stop unless they act.
  const atStake = cents ? { monthlyAtStake: nonRenewing * cents } : {};
  const remindFrom = trialReminderFrom(snapshot, nonRenewing, subscribers, now);
  if (remindFrom) return { id, severity: "medium", heldBy: "trial", heldUntil: remindFrom.toISOString(), ...atStake };
  return { id, severity: "medium", action: { kind: "renewal", recipients: nonRenewing }, ...atStake };
};

export const continuityChurnRising: Rule = (snapshot, now) => {
  const id = "continuity.churn-rising";
  if (!snapshot.retention.ok) return { id, severity: "unavailable" };
  // Weekly, most recent first. A newer page has too little history to call a trend.
  const weeks = snapshot.retention.data;
  if (weeks.length <= CHURN_LOOKBACK_WEEKS) return { id, severity: "ok" };

  const rise = weeks[0]!.paidFanChurnRate - weeks[CHURN_LOOKBACK_WEEKS]!.paidFanChurnRate;
  if (rise < CHURN_RISE) return { id, severity: "ok" };

  const nonRenewing = smartListCount(snapshot, "non_renewing");
  if (!nonRenewing) return { id, severity: "high" };
  // The same message as auto-renew's, so it waits for the same trial.
  const subscribers = smartListCount(snapshot, "subscribers");
  const remindFrom = subscribers ? trialReminderFrom(snapshot, nonRenewing, subscribers, now) : null;
  if (remindFrom) return { id, severity: "high", heldBy: "trial", heldUntil: remindFrom.toISOString() };
  return { id, severity: "high", action: { kind: "renewal", recipients: nonRenewing } };
};
