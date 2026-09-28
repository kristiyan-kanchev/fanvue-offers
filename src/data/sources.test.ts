import { describe, expect, it } from "vitest";
import { fakeClient } from "@/test/helpers";
import { createFixtureSource } from "./fixture-source";
import { createLiveSource, createSnapshotCache } from "./live-source";
import account from "./fixtures/maya/account";

const NOW = new Date("2026-09-23T12:00:00.000Z");

/** A live client that answers every read from the Maya fixtures. */
function mayaApi(overrides: Record<string, { status: number; body?: unknown }> = {}) {
  const bodies: Record<string, unknown> = {
    "/users/me": { uuid: "maya-uuid", displayName: "Coach Maya", handle: "coachmaya" },
    "/users/account": account,
    "/chats/lists/smart": [],
    "/promotions": { data: [] },
    "/free-trial-links": { data: [] },
    "/insights/fan-retention-summary": { snapshots: [] },
    "/insights/unsubscribe-reasons": { reasons: [], currentWeekTotal: 0, rollingTotal: 0 },
    "/chats/automated-messages": { data: [] },
    "/chats/mass-messages": {
      data: [
        {
          uuid: "m-1",
          text: "Private text that must not be kept",
          status: "SENT",
          price: 1200,
          createdAt: "2026-09-09",
          recipientCount: 10,
          purchaseCount: 2,
          totalRevenue: 2400,
          mediaUuids: ["x"],
          includedLists: { smartListIds: ["subscribers"], smartListUuids: [], customListUuids: [] },
        },
      ],
    },
  };
  return fakeClient((call) => overrides[call.path] ?? { status: 200, body: bodies[call.path] });
}

describe("the subscription price", () => {
  it("is set for Maya and null for the day-one creator, never zero", async () => {
    const maya = await createFixtureSource({ persona: "maya", now: () => NOW }).getSnapshot();
    const sam = await createFixtureSource({ persona: "day-one", now: () => NOW }).getSnapshot();
    expect(maya.creator.subscriptionPrice).toBe(999);
    expect(sam.creator.subscriptionPrice).toBeNull();
  });

  it("is read from GET /users/account in live mode", async () => {
    const { client, calls } = mayaApi();
    const snapshot = await createLiveSource({ client, cache: createSnapshotCache() }).getSnapshot();
    expect(snapshot.creator.subscriptionPrice).toBe(999);
    expect(calls.map((c) => c.path)).toContain("/users/account");
  });

  it("falls back to null when the account read fails, without failing the audit", async () => {
    const { client } = mayaApi({ "/users/account": { status: 500, body: { message: "down" } } });
    const snapshot = await createLiveSource({ client, cache: createSnapshotCache() }).getSnapshot();
    expect(snapshot.creator.subscriptionPrice).toBeNull();
    expect(snapshot.smartLists.ok).toBe(true);
  });
});

describe("the cache", () => {
  it("serves a second read from the cache, making only the identity request", async () => {
    const cache = createSnapshotCache();
    const { client, calls } = mayaApi();
    await createLiveSource({ client, cache }).getSnapshot();
    const before = calls.length;
    await createLiveSource({ client, cache }).getSnapshot();
    expect(calls.length - before).toBe(1);
  });
});

describe("what is kept from a read", () => {
  it("keeps a mass message's counts and drops its text and media", async () => {
    const { client } = mayaApi();
    const snapshot = await createLiveSource({ client, cache: createSnapshotCache() }).getSnapshot();
    expect(snapshot.massMessages).toEqual({
      ok: true,
      data: [
        {
          uuid: "m-1",
          status: "SENT",
          price: 1200,
          recipientCount: 10,
          purchaseCount: 2,
          totalRevenue: 2400,
          createdAt: "2026-09-09",
          publishedAt: undefined,
          scheduledAt: undefined,
          smartListIds: ["subscribers"],
        },
      ],
    });
  });
});

describe("a Fanvue answer in a shape the rules don't expect", () => {
  it("marks just that part unavailable, and the page still renders", async () => {
    const { client } = mayaApi({
      "/chats/lists/smart": { status: 200, body: { data: [] } },
      "/promotions": { status: 200, body: { data: null } },
      "/insights/fan-retention-summary": { status: 200, body: { snapshots: [{ periodStart: "2026-09-01" }] } },
    });
    const snapshot = await createLiveSource({ client, cache: createSnapshotCache() }).getSnapshot();
    expect(snapshot.smartLists).toMatchObject({ ok: false, error: expect.stringMatching(/shape we didn't expect/) });
    expect(snapshot.promotions.ok).toBe(false);
    expect(snapshot.retention.ok).toBe(false);
    expect(snapshot.freeTrialLinks.ok).toBe(true);

    const { audit } = await import("@/audit/audit");
    const { tellStory } = await import("@/audit/story");
    expect(() => tellStory(audit(snapshot), snapshot)).not.toThrow();
  });
});
