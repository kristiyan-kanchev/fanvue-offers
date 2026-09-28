import { describe, expect, it } from "vitest";
import { audit } from "@/audit/audit";
import { createFixtureSource } from "@/data/fixture-source";
import type { DemoSend } from "@/data/types";
import { mayaSnapshot } from "@/test/helpers";
import { APPROACHES, PLACEHOLDER } from "./approaches";
import { userPrompt } from "./draft-copy";
import { liveOfferFor } from "./guards";
import { planFromEdits, preparePlan } from "./registry";
import { endOfDayAfter } from "./plan";

const DEMO_BUDGET = { budget: "demo" as const };

const NOW = new Date("2026-09-23T10:00:00.000Z");
const KEY = "key-0002";
const FUTURE = endOfDayAfter(new Date(), 7);

describe("opening a fix", () => {
  it("starts on the suggested approach: a discount, since Maya's fans left over price", async () => {
    const prepared = await preparePlan("winback", await mayaSnapshot(), {}, DEMO_BUDGET);
    expect(prepared?.plan.approach).toBe("comeback-discount");
    expect(prepared?.plan.offer).toEqual({ type: "discount", percent: 40 });
  });

  it("switches approach and offer on request, and redrafts to match", async () => {
    const prepared = await preparePlan("front-door", await mayaSnapshot(), {
      approach: "first-month-off",
      value: 20,
    }, DEMO_BUDGET);
    expect(prepared?.plan.offer).toEqual({ type: "discount", percent: 20 });
    expect(prepared?.plan.messageText).toContain("20% off");
  });

  it("refuses an approach from another problem, or an offer out of range", async () => {
    const snapshot = await mayaSnapshot();
    expect(await preparePlan("winback", snapshot, { approach: "free-trial" }, DEMO_BUDGET)).toBeNull();
    expect(await preparePlan("front-door", snapshot, { approach: "free-trial", value: 31 }, DEMO_BUDGET)).toBeNull();
    expect(await preparePlan("renewal", snapshot, { approach: "friendly-reminder", value: 10 }, DEMO_BUDGET)).toBeNull();
  });
});

describe("sending, checked on the server", () => {
  const common = { idempotencyKey: KEY, messageText: "Hi" };

  it("rebuilds recipients from the snapshot, not from the browser", async () => {
    const plan = planFromEdits("renewal", await mayaSnapshot(), {
      ...common,
      approach: "friendly-reminder",
      recipientEstimate: 1_000_000,
    });
    expect(plan?.recipientEstimate).toBe(358);
  });

  it("needs a valid offer and a future end date for an approach with an offer", async () => {
    const snapshot = await mayaSnapshot();
    const ok = { ...common, approach: "comeback-discount", value: 30, endsAt: FUTURE };
    expect(planFromEdits("winback", snapshot, ok)?.offer).toEqual({ type: "discount", percent: 30 });
    expect(planFromEdits("winback", snapshot, { ...ok, value: undefined })).toBeNull();
    expect(planFromEdits("winback", snapshot, { ...ok, endsAt: "2020-01-01T00:00:00.000Z" })).toBeNull();
    // Later than the approach's own window: an offer can't be opened for years by hand.
    expect(planFromEdits("winback", snapshot, { ...ok, endsAt: "2099-01-01T00:00:00.000Z" })).toBeNull();
    // Only the values the page offers.
    expect(planFromEdits("winback", snapshot, { ...ok, value: 100 })).toBeNull();
    expect(planFromEdits("winback", snapshot, { ...ok, value: 35 })).toBeNull();
    expect(planFromEdits("front-door", snapshot, { ...ok, approach: "free-trial", value: 31 })).toBeNull();
    expect(planFromEdits("winback", snapshot, { ...ok, approach: "free-trial" })).toBeNull();
  });

  it("ignores an offer sent with an approach that has none", async () => {
    const plan = planFromEdits("winback", await mayaSnapshot(), {
      ...common,
      approach: "just-ask",
      value: 90,
      endsAt: FUTURE,
    });
    expect(plan?.offer).toBeNull();
  });
});

describe("drafting every approach without a model", () => {
  it("writes a message that says the offer, and asks the creator only where it must", async () => {
    const snapshot = await mayaSnapshot();
    for (const [kind, approaches] of Object.entries(APPROACHES) as [keyof typeof APPROACHES, (typeof APPROACHES)["winback"]][]) {
      for (const approach of approaches) {
        const prepared = (await preparePlan(kind, snapshot, { approach: approach.id }, DEMO_BUDGET))!;
        const text = prepared.plan.messageText;
        expect(prepared.draft.source).toBe("template");
        expect(text.length, approach.id).toBeGreaterThan(40);
        expect(text, approach.id).not.toMatch(/!|unsubscribe|train|programme|fitness/i);
        if (approach.offer?.type === "discount") expect(text, approach.id).toContain(`${approach.offer.default}% off`);
        if (approach.offer?.type === "trial") expect(text, approach.id).toContain(`${approach.offer.default} days free`);
        // Only the approaches built on something the creator knows leave a gap for it.
        expect(PLACEHOLDER.test(text), approach.id).toBe(approach.id === "just-ask" || approach.id === "whats-coming");
      }
    }
  });

  it("gives the model the creator's own broadcasts, and nothing about a fan", async () => {
    const snapshot = await mayaSnapshot();
    expect(snapshot.creator.voiceSamples).toHaveLength(2);
    const prompt = userPrompt({
      approach: "friendly-reminder",
      creatorName: snapshot.creator.displayName,
      voiceSamples: snapshot.creator.voiceSamples,
      recipientCount: 358,
      offer: null,
      endsAt: null,
    });
    expect(prompt).toContain("Messages this creator wrote before, for voice only:");
    expect(prompt).toContain(snapshot.creator.voiceSamples[0]);
  });
});

describe("the demo closes the loop", () => {
  const sent: DemoSend[] = [
    {
      kind: "winback",
      at: "2026-09-23T09:00:00.000Z",
      recipients: 178,
      offer: { type: "trial", days: 7 },
      endsAt: "2026-09-30T23:59:59.000Z",
    },
    { kind: "renewal", at: "2026-09-23T09:05:00.000Z", recipients: 358, offer: null, endsAt: null },
  ];

  it("shows a dry run the way Fanvue would show a real send", async () => {
    const snapshot = await createFixtureSource({ persona: "maya", now: () => NOW, sent }).getSnapshot();
    const report = audit(snapshot, NOW);
    expect(report.findings.find((f) => f.id === "downsell.no-winback")!.severity).toBe("ok");
    const renewal = report.findings.find((f) => f.id === "continuity.auto-renew-off")!;
    expect(renewal.action).toBeUndefined();
    expect(renewal.heldBy).toBe("recent-message");
    expect(report.findings.filter((f) => f.action).map((f) => f.action!.kind)).toEqual(["front-door"]);
  });

  it("lets a failed message be resent only while its offer is live", async () => {
    const live = await createFixtureSource({ persona: "maya", now: () => NOW, sent }).getSnapshot();
    expect(liveOfferFor(live, "winback", NOW)?.freeTrialDays).toBe(7);
    expect(liveOfferFor(live, "winback", new Date("2026-10-01T00:00:00.000Z"))).toBeNull();
    expect(liveOfferFor(await mayaSnapshot(), "winback", NOW)).toBeNull();
  });
});
