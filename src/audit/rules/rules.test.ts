import { describe, expect, it } from "vitest";
import { available, type FreeTrialLink, type Promotion } from "@/data/types";
import { emptySnapshot, healthySnapshot, markUnavailable, mayaSnapshot, sentTo } from "@/test/helpers";
import { audit, rankActions } from "../audit";
import type { Finding, FindingId } from "../types";
import { isPromotionLive } from "./helpers";

function byId(findings: Finding[], id: FindingId): Finding {
  const found = findings.find((f) => f.id === id);
  if (!found) throw new Error(`No finding ${id}`);
  return found;
}

describe("Coach Maya's account", () => {
  it("is scored the way her numbers say", async () => {
    const report = audit(await mayaSnapshot());
    expect(Object.fromEntries(report.findings.map((f) => [f.id, f.severity]))).toEqual({
      "attraction.no-front-door": "high",
      "downsell.no-winback": "high",
      "continuity.auto-renew-off": "medium",
      "continuity.churn-rising": "high",
    });
    expect(report.dayOne).toBeNull();
  });

  it("offers a fix for each problem, sized by its list", async () => {
    const { findings } = audit(await mayaSnapshot());
    expect(byId(findings, "attraction.no-front-door").action).toEqual({ kind: "front-door", recipients: 2156 });
    expect(byId(findings, "downsell.no-winback").action).toEqual({ kind: "winback", recipients: 178 });
    expect(byId(findings, "continuity.auto-renew-off").action).toEqual({ kind: "renewal", recipients: 358 });
  });

  it("gives rising churn's message to the auto-renew fix, which reaches the same people", async () => {
    const churn = byId(audit(await mayaSnapshot()).findings, "continuity.churn-rising");
    expect(churn.action).toBeUndefined();
    expect(churn.heldBy).toBe("another-fix");
  });
});

describe("money at stake", () => {
  it("is the list at the current price, for ordering fixes", async () => {
    const { findings } = audit(await mayaSnapshot());
    expect(byId(findings, "downsell.no-winback").monthlyAtStake).toBe(178 * 999);
    expect(byId(findings, "continuity.auto-renew-off").monthlyAtStake).toBe(358 * 999);
  });

  it("isn't guessed for followers: that would need a conversion rate nobody has", async () => {
    expect(byId(audit(await mayaSnapshot()).findings, "attraction.no-front-door").monthlyAtStake).toBeUndefined();
  });

  it("is unknown without a price, and a zero price counts as no price", async () => {
    const base = await mayaSnapshot();
    for (const subscriptionPrice of [null, 0]) {
      const { findings } = audit({ ...base, creator: { ...base.creator, subscriptionPrice } });
      expect(byId(findings, "downsell.no-winback").monthlyAtStake).toBeUndefined();
      expect(byId(findings, "downsell.no-winback").action?.recipients).toBe(178);
    }
  });
});

describe("one list, one message a week", () => {
  const NOW = new Date("2026-09-23T10:00:00.000Z");

  async function mayaAfterMessaging(list: Parameters<typeof sentTo>[0], at: string) {
    const base = await mayaSnapshot();
    if (!base.massMessages.ok) throw new Error("Maya's fixtures must include mass messages.");
    return { ...base, massMessages: available([sentTo(list, at), ...base.massMessages.data]) };
  }

  it("holds back a fix whose list was messaged in the last week", async () => {
    const { findings } = audit(await mayaAfterMessaging("non_renewing", "2026-09-20T09:00:00.000Z"), NOW);
    for (const id of ["continuity.auto-renew-off", "continuity.churn-rising"] as const) {
      expect(byId(findings, id).action).toBeUndefined();
      expect(byId(findings, id).heldBy).toBe("recent-message");
    }
  });

  it("offers it again once the week is up", async () => {
    const { findings } = audit(await mayaAfterMessaging("non_renewing", "2026-09-15T09:00:00.000Z"), NOW);
    expect(byId(findings, "continuity.auto-renew-off").action?.kind).toBe("renewal");
  });

  it("counts a scheduled message, and ignores one that was never sent", async () => {
    const base = await mayaSnapshot();
    const withStatus = (status: Parameters<typeof sentTo>[2]) => ({
      ...base,
      massMessages: available([sentTo("expired_subscribers", "2026-09-22T09:00:00.000Z", status)]),
    });
    expect(byId(audit(withStatus("SCHEDULED"), NOW).findings, "downsell.no-winback").action).toBeUndefined();
    expect(byId(audit(withStatus("UNSENT"), NOW).findings, "downsell.no-winback").action?.kind).toBe("winback");
  });

  it("doesn't block anything when the message record can't be read", async () => {
    const { findings } = audit(markUnavailable(await mayaSnapshot(), "massMessages"), NOW);
    expect(byId(findings, "downsell.no-winback").action?.kind).toBe("winback");
  });

  it("never offers two fixes that message the same people", async () => {
    const variants = [
      await mayaSnapshot(),
      await healthySnapshot(),
      markUnavailable(await mayaSnapshot(), "promotions"),
      markUnavailable(await mayaSnapshot(), "smartLists"),
    ];
    for (const snapshot of variants) {
      const kinds = audit(snapshot).findings.flatMap((f) => (f.action ? [f.action.kind] : []));
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it("lets rising churn carry the renewal message when auto-renew isn't the problem", async () => {
    const base = await mayaSnapshot();
    const smartLists = available(
      (base.smartLists.ok ? base.smartLists.data : []).map((list) =>
        list.uuid === "non_renewing" ? { ...list, count: 150 } : list,
      ),
    );
    const { findings } = audit({ ...base, smartLists });
    expect(byId(findings, "continuity.auto-renew-off").severity).toBe("ok");
    expect(byId(findings, "continuity.churn-rising").action).toEqual({ kind: "renewal", recipients: 150 });
  });
});

describe("which fix comes first", () => {
  it("is the worst, then the most money, within a severity", async () => {
    const { findings } = audit(await mayaSnapshot());
    expect(rankActions(findings).map((f) => f.id)).toEqual([
      "downsell.no-winback",
      "attraction.no-front-door",
      // Most money of all, but medium: severity is how sure the rules are.
      "continuity.auto-renew-off",
    ]);
  });

  it("is nothing on a healthy account", async () => {
    const { findings } = audit(await healthySnapshot());
    expect(findings.map((f) => f.severity)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(rankActions(findings)).toEqual([]);
  });
});

describe("a read that failed", () => {
  it("marks only the rules that need it unavailable", async () => {
    const { findings } = audit(markUnavailable(await mayaSnapshot(), "smartLists"));
    expect(byId(findings, "attraction.no-front-door").severity).toBe("unavailable");
    expect(byId(findings, "downsell.no-winback").severity).toBe("unavailable");
    expect(byId(findings, "continuity.auto-renew-off").severity).toBe("unavailable");
    expect(byId(findings, "continuity.churn-rising").severity).toBe("high");
  });

  it("tells a failed retention read apart from a page too new to have a trend", async () => {
    const maya = await mayaSnapshot();
    const unread = audit(markUnavailable(maya, "retention")).findings;
    expect(byId(unread, "continuity.churn-rising").severity).toBe("unavailable");
    if (!maya.retention.ok) throw new Error("Maya's fixtures must include retention.");
    const newPage = audit({ ...maya, retention: available(maya.retention.data.slice(0, 2)) }).findings;
    expect(byId(newPage, "continuity.churn-rising").severity).toBe("ok");
  });

  it("never offers a fix it can't size", async () => {
    const finding = byId(audit(markUnavailable(await mayaSnapshot(), "promotions")).findings, "downsell.no-winback");
    expect(finding.severity).toBe("unavailable");
    expect(finding.action).toBeUndefined();
  });
});

describe("a brand new account", () => {
  it("gets a setup checklist instead", async () => {
    const report = audit(await emptySnapshot());
    expect(report.dayOne?.items.map((item) => item.id)).toEqual(["price", "welcome", "trial-link"]);
    expect(report.dayOne?.completedCount).toBe(0);
  });

  it("ticks what's already done", async () => {
    const snapshot = await emptySnapshot();
    if (snapshot.automatedMessages.ok) {
      snapshot.automatedMessages = available(
        snapshot.automatedMessages.data.map((message) =>
          message.trigger === "new_subscriber" ? { ...message, enabled: true } : message,
        ),
      );
    }
    const report = audit(snapshot);
    expect(report.dayOne?.items.find((item) => item.id === "welcome")?.done).toBe(true);
    expect(report.dayOne?.completedCount).toBe(1);
  });
});

describe("offers and links", () => {
  const link = (over: Partial<FreeTrialLink>): FreeTrialLink => ({
    uuid: "l1",
    url: "https://www.fanvue.com/x?free_trial=1",
    maxUsages: null,
    name: null,
    usedCount: 0,
    trialDurationDays: 7,
    expiresAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...over,
  });
  const frontDoor = async (links: FreeTrialLink[]) =>
    byId(audit({ ...(await mayaSnapshot()), freeTrialLinks: available(links) }).findings, "attraction.no-front-door");

  it("count as a way in while they work", async () => {
    expect((await frontDoor([link({})])).severity).toBe("ok");
  });

  it("don't once they've expired or been used up", async () => {
    expect((await frontDoor([link({ expiresAt: "2025-06-01T00:00:00.000Z" })])).severity).toBe("high");
    expect((await frontDoor([link({ maxUsages: 10, usedCount: 10 })])).severity).toBe("high");
  });

  it("keep counting after the last follower takes the trial and becomes a subscriber", async () => {
    const base = await mayaSnapshot();
    const trial: Promotion = {
      uuid: "trial-1",
      type: "free_trial",
      discountPercent: null,
      freeTrialDays: 7,
      availableToGroup: "followers",
      endsAt: "2099-01-01T00:00:00.000Z",
      maxUsages: null,
      usedCount: 1,
      message: null,
      createdAt: "2026-09-24T10:00:00.000Z",
    };
    const snapshot = {
      ...base,
      smartLists: available([
        { name: "Subscribers", uuid: "subscribers" as const, count: 1 },
        { name: "Followers", uuid: "followers" as const, count: 0 },
      ]),
      promotions: available([trial]),
    };
    expect(byId(audit(snapshot).findings, "attraction.no-front-door").severity).toBe("ok");
    expect(isPromotionLive({ ...trial, maxUsages: 1 }, new Date())).toBe(false);
  });
});
