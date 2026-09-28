import { describe, expect, it } from "vitest";
import { createFixtureSource } from "@/data/fixture-source";
import { available, type DemoSend } from "@/data/types";
import { emptySnapshot, healthySnapshot, markUnavailable, mayaSnapshot } from "@/test/helpers";
import { audit } from "./audit";
import { tellStory } from "./story";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const story = async (snapshot: Awaited<ReturnType<typeof mayaSnapshot>>) =>
  tellStory(audit(snapshot, NOW), snapshot, NOW);

/** Words from the engine that must never reach the screen. */
const JARGON = /rung|ladder|severity|downsell|upsell|attraction|continuity|smart list|expired_|non_renewing|promotion/i;

describe("the overview, in plain words", () => {
  it("lists what to fix, worst first, each with a plan and what it is worth", async () => {
    const { todo } = await story(await mayaSnapshot());
    expect(todo.map((c) => c.kind)).toEqual(["winback", "front-door", "renewal"]);
    expect(todo[0]).toMatchObject({
      title: "178 fans who used to pay you have left",
      worth: "Every fan who comes back is US$9.99 a month.",
      people: 178,
    });
    for (const card of todo) {
      expect(card.plan).toBeTruthy();
      expect(`${card.title} ${card.why} ${card.plan} ${card.worth}`).not.toMatch(JARGON);
    }
  });

  it("moves a fix to done once its offer is live, with how it is going", async () => {
    const sent: DemoSend[] = [
      {
        kind: "winback",
        at: "2026-09-23T09:00:00.000Z",
        recipients: 178,
        offer: { type: "discount", percent: 30 },
        endsAt: "2026-09-30T23:59:59.000Z",
      },
      { kind: "renewal", at: "2026-09-23T09:05:00.000Z", recipients: 358, offer: null, endsAt: null },
    ];
    const s = await story(await createFixtureSource({ persona: "maya", now: () => NOW, sent: sent }).getSnapshot());
    expect(s.todo.map((c) => c.kind)).toEqual(["front-door"]);
    expect(s.inProgress.map((c) => [c.title, c.status])).toEqual([
      ["Your comeback offer is live", "30% off their next month until 30 Sept 2026. Nobody has used it yet."],
      [
        "Subscribers set to leave: message sent",
        "Sent 23 Sept 2026. Back on 30 Sept 2026 if it still needs doing, so nobody gets two in a week.",
      ],
    ]);
  });

  it("has nothing to fix for a healthy creator", async () => {
    const s = await story(await healthySnapshot());
    expect(s.todo).toEqual([]);
  });

  it("says plainly when a check could not run", async () => {
    const s = await story(markUnavailable(await mayaSnapshot(), "smartLists"));
    expect(s.unknown.map((c) => c.title)).toContain("Fans who left: we couldn't read this from Fanvue.");
  });

  it("does not crash on an empty account", async () => {
    const s = await story(await emptySnapshot());
    expect(s.todo).toEqual([]);
  });
});

describe("one of something", () => {
  it("is never '1 people'", async () => {
    const base = await mayaSnapshot();
    const one = (uuid: "followers" | "non_renewing" | "expired_subscribers") => ({ name: uuid, uuid, count: 1 });
    const snapshot = {
      ...base,
      smartLists: {
        ok: true as const,
        data: [{ name: "Subscribers", uuid: "subscribers" as const, count: 1 }, one("followers"), one("non_renewing")],
      },
    };
    const titles = (await story(snapshot)).todo.map((c) => c.title);
    expect(titles).toContain("1 person follows you but doesn't subscribe");
    expect(titles).toContain("1 subscriber is set to leave");
    expect(titles.join(" ")).not.toMatch(/\b1 (people|fans|subscribers)\b/);
  });
});

describe("done, whichever approach was used", () => {
  it("names the offer that is live", async () => {
    const at = "2026-09-23T09:00:00.000Z";
    const endsAt = "2026-10-07T23:59:59.000Z";
    const sent: DemoSend[] = [
      { kind: "winback", at, recipients: 178, offer: { type: "trial", days: 7 }, endsAt },
      { kind: "front-door", at, recipients: 2156, offer: { type: "discount", percent: 20 }, endsAt },
    ];
    const s = await story(await createFixtureSource({ persona: "maya", now: () => NOW, sent: sent }).getSnapshot());
    expect(s.inProgress.map((c) => [c.title, c.status])).toEqual([
      ["Your free week back is live", "7 days free until 7 Oct 2026. Nobody has used it yet."],
      ["Your first-month discount is live", "20% off the first month until 7 Oct 2026. Nobody has used it yet."],
    ]);
  });

  it("counts a message-only fix as sent, so it isn't offered again for a week", async () => {
    const sent: DemoSend[] = [
      { kind: "winback", at: "2026-09-23T09:00:00.000Z", recipients: 178, offer: null, endsAt: null },
    ];
    const s = await story(await createFixtureSource({ persona: "maya", now: () => NOW, sent: sent }).getSnapshot());
    expect(s.todo.map((c) => c.kind)).not.toContain("winback");
    expect(s.inProgress[0].title).toBe("Fans who left: message sent");
  });
});

describe("the automatic reminder on the overview", () => {
  it("shows as done once it's on", async () => {
    const sent: DemoSend[] = [
      {
        kind: "renewal",
        at: "2026-09-23T09:05:00.000Z",
        recipients: 358,
        offer: null,
        endsAt: null,
        automatedText: "Auto-renew is off.",
      },
    ];
    const s = await story(await createFixtureSource({ persona: "maya", now: () => NOW, sent: sent }).getSnapshot());
    expect(s.inProgress.map((c) => c.title)).toContain("Your automatic reminder is on");
  });
});

describe("a fan who just took a free trial", () => {
  // The real end-to-end run: a follower took a 7-day trial and has auto-renew off.
  async function trialSnapshot() {
    const base = await mayaSnapshot();
    return {
      ...base,
      smartLists: available([
        { name: "Subscribers", uuid: "subscribers" as const, count: 1 },
        { name: "Non-renewing", uuid: "non_renewing" as const, count: 1 },
        { name: "Free trial subscribers", uuid: "free_trial_subscribers" as const, count: 1 },
        { name: "Followers", uuid: "followers" as const, count: 0 },
        { name: "Expired subscribers", uuid: "expired_subscribers" as const, count: 0 },
      ]),
      promotions: available([
        {
          uuid: "trial",
          type: "free_trial" as const,
          discountPercent: null,
          freeTrialDays: 7,
          availableToGroup: "followers" as const,
          endsAt: "2026-10-09T23:59:59.000Z",
          maxUsages: null,
          usedCount: 1,
          message: null,
          createdAt: "2026-09-25T19:30:00.000Z",
        },
      ]),
      retention: available([]),
    };
  }

  it("holds the renewal reminder until a few days before the trial ends", async () => {
    const snapshot = await trialSnapshot();
    const soon = tellStory(audit(snapshot, new Date("2026-09-26T10:00:00.000Z")), snapshot, new Date("2026-09-26T10:00:00.000Z"));
    expect(soon.todo.map((c) => c.kind)).not.toContain("renewal");
    expect(soon.inProgress.map((c) => c.title)).toContain("Your trial fan gets a reminder on 29 Sept 2026");

    const later = new Date("2026-09-30T10:00:00.000Z");
    expect(tellStory(audit(snapshot, later), snapshot, later).todo.map((c) => c.kind)).toContain("renewal");
  });

  it("holds it even when weekly churn is rising, since that fix sends the same message", async () => {
    const maya = await mayaSnapshot();
    const snapshot = { ...(await trialSnapshot()), retention: maya.retention };
    const now = new Date("2026-09-26T10:00:00.000Z");
    const soon = tellStory(audit(snapshot, now), snapshot, now);
    expect(soon.todo.map((c) => c.kind)).not.toContain("renewal");
    expect(soon.inProgress.map((c) => c.title)).toContain("Your trial fan gets a reminder on 29 Sept 2026");
  });

  it("says nothing about lists with nobody on them", async () => {
    const snapshot = await trialSnapshot();
    const { fine } = await story(snapshot);
    expect(fine.map((c) => c.kind)).not.toContain("winback");
    expect(fine.map((c) => c.kind)).not.toContain("front-door");
  });
});
