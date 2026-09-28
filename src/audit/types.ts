import type { CreatorSnapshot } from "@/data/types";

/** The three things the app can fix. Each is an optional offer and one message. */
export const ACTION_KINDS = ["winback", "front-door", "renewal"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export function isActionKind(value: unknown): value is ActionKind {
  return ACTION_KINDS.includes(value as ActionKind);
}

/** The smart list a fix messages. */
export type Audience = "expired_subscribers" | "followers" | "non_renewing";

export type FindingId =
  | "attraction.no-front-door"
  | "downsell.no-winback"
  | "continuity.auto-renew-off"
  | "continuity.churn-rising";

/** `unavailable`: a read the rule needs failed, so it wasn't judged. */
export type Severity = "high" | "medium" | "ok" | "unavailable";

export interface Finding {
  id: FindingId;
  severity: Severity;
  /** The fix to offer, and how many people it messages. */
  action?: { kind: ActionKind; recipients: number };
  /**
   * Why a fix isn't offered: another finding's fix already reaches these
   * people, they were messaged in the last week, or they're on a free trial
   * that isn't near its end yet.
   */
  heldBy?: "another-fix" | "recent-message" | "trial";
  /** For a fix held for a trial: when it comes back, as an ISO date. */
  heldUntil?: string;
  /** USD cents a month behind the finding, when the price makes it knowable. Orders fixes of equal severity. */
  monthlyAtStake?: number;
}

export type Rule = (snapshot: CreatorSnapshot, now: Date) => Finding;

export type SetupStep = "price" | "welcome" | "trial-link";

/** One of the three things a brand new account sets up before its first fan. */
export interface DayOneItem {
  id: SetupStep;
  label: string;
  done: boolean;
  why: string;
  /** What's set: "US$9.99 a month", the welcome text, "7 days free". */
  detail?: string;
  /** The trial link to share, once there is one. */
  url?: string;
}

export interface DayOneReport {
  items: DayOneItem[];
  completedCount: number;
}

export interface AuditReport {
  findings: Finding[];
  /** Set for an account with no fans yet, which gets a setup checklist instead. */
  dayOne: DayOneReport | null;
}
