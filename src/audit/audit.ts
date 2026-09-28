import { messagedRecently } from "@/actions/guards";
import { AUDIENCE } from "@/actions/plan";
import type { CreatorSnapshot } from "@/data/types";
import { attractionNoFrontDoor } from "./rules/attraction";
import { continuityAutoRenewOff, continuityChurnRising } from "./rules/continuity";
import { dayOneReport, isDayOne } from "./rules/day-one";
import { downsellNoWinback } from "./rules/downsell";
import type { AuditReport, Finding, Rule, Severity } from "./types";

/** Pure: snapshot in, findings out. When two would message the same people, the earlier one keeps the fix. */
const RULES: Rule[] = [
  attractionNoFrontDoor,
  downsellNoWinback,
  continuityAutoRenewOff,
  continuityChurnRising,
];

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, ok: 2, unavailable: 3 };

function hold(finding: Finding, heldBy: Finding["heldBy"]): Finding {
  const { action: _held, ...rest } = finding;
  return { ...rest, heldBy };
}

/** One message per list: never two fixes for the same people, and not twice in a week. */
function holdRepeats(findings: Finding[], snapshot: CreatorSnapshot, now: Date): Finding[] {
  const claimed = new Set<string>();
  return findings.map((finding) => {
    if (!finding.action) return finding;
    const list = AUDIENCE[finding.action.kind];
    if (messagedRecently(snapshot, list, now)) return hold(finding, "recent-message");
    if (claimed.has(list)) return hold(finding, "another-fix");
    claimed.add(list);
    return finding;
  });
}

/**
 * The fixes to offer, worst first: severity is how sure the rules are that
 * money is leaving. Within a severity, the most money at stake first.
 */
export function rankActions(findings: Finding[]): Finding[] {
  return findings
    .filter((finding) => finding.action && !finding.heldBy && SEVERITY_RANK[finding.severity] < SEVERITY_RANK.ok)
    .toSorted(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        (b.monthlyAtStake ?? -1) - (a.monthlyAtStake ?? -1),
    );
}

export function audit(snapshot: CreatorSnapshot, now = new Date()): AuditReport {
  return {
    findings: holdRepeats(
      RULES.map((rule) => rule(snapshot, now)),
      snapshot,
      now,
    ),
    dayOne: isDayOne(snapshot) ? dayOneReport(snapshot, now) : null,
  };
}
