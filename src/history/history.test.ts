import { describe, expect, it } from "vitest";
import { createFixtureSource } from "@/data/fixture-source";
import { available, type CreatorSnapshot, type DemoSend, type Promotion } from "@/data/types";
import { demoHistory } from "./demo";
import { historyRow, historyRows, historyTotals, usageUpdates, type HistoryEntry } from "./history";

const now = new Date("2026-09-25T12:00:00Z");

async function snapshotWith(promotions: Promotion[]): Promise<CreatorSnapshot> {
  const snapshot = await createFixtureSource({ persona: "maya", now: () => now }).getSnapshot();
  return { ...snapshot, promotions: available(promotions) };
}

function promotion(uuid: string, usedCount: number, endsAt: string | null): Promotion {
  return {
    uuid,
    type: "discount",
    discountPercent: 40,
    freeTrialDays: null,
    availableToGroup: "expired_subscribers",
    endsAt,
    maxUsages: null,
    usedCount,
    message: null,
    createdAt: "2026-09-20T12:00:00Z",
  };
}

const winback: HistoryEntry = {
  id: "m1",
  kind: "winback",
  approach: "comeback-discount",
  sentAt: "2026-09-20T12:00:00Z",
  recipients: 178,
  offer: { type: "discount", percent: 40 },
  endsAt: "2026-09-27T23:59:59Z",
  promotionUuid: "p1",
  price: 999,
  automated: false,
  used: 0,
};

describe("a history row", () => {
  it("counts a live discount from Fanvue, and what it has earned", async () => {
    const row = historyRow(winback, await snapshotWith([promotion("p1", 12, winback.endsAt)]), now);
    expect(row.status).toBe("live");
    expect(row.result).toBe("12 fans came back");
    // 12 fans paid 40% off $9.99, rounded to the cent: $5.99 each.
    expect(row.earned).toBe(12 * 599);
    expect(row.note).toContain("US$71.88 so far");
    expect(row.note).toContain("Open until");
  });

  it("keeps the last count once Fanvue stops listing the offer", async () => {
    const row = historyRow({ ...winback, used: 9 }, await snapshotWith([]), now);
    expect(row.status).toBe("ended");
    expect(row.took).toBe(9);
    expect(row.note).not.toContain("Open until");
  });

  it("says nobody has used a live offer yet, without inventing money", async () => {
    const row = historyRow(winback, await snapshotWith([promotion("p1", 0, winback.endsAt)]), now);
    expect(row.result).toBe("Nobody's used it yet");
    expect(row.earned).toBeNull();
  });

  it("puts no money on a free trial, only what it's worth if they stay", async () => {
    const trial: HistoryEntry = {
      ...winback,
      kind: "front-door",
      approach: "free-trial",
      offer: { type: "trial", days: 7 },
      used: 4,
      promotionUuid: "gone",
    };
    const row = historyRow(trial, await snapshotWith([]), now);
    expect(row.result).toBe("4 started a free trial");
    expect(row.earned).toBeNull();
    expect(row.note).toContain("Worth US$39.96/mo if they stay");
  });

  it("is honest that a message with no offer can't be measured", async () => {
    const reminder: HistoryEntry = {
      ...winback,
      kind: "renewal",
      approach: "friendly-reminder",
      offer: null,
      endsAt: null,
      promotionUuid: null,
      used: null,
      recipients: 1,
    };
    const row = historyRow(reminder, await snapshotWith([]), now);
    expect(row.result).toBe("Sent to 1 subscriber");
    expect(row.took).toBeNull();
    expect(row.status).toBe("sent");
  });
});

describe("the history list", () => {
  it("adds up the money and the people, newest first", async () => {
    const snapshot = await snapshotWith([promotion("p1", 2, winback.endsAt)]);
    const older = { ...winback, id: "m0", sentAt: "2026-08-01T12:00:00Z", promotionUuid: "old", used: 3 };
    const rows = historyRows([older, winback], snapshot, now);
    expect(rows.map((r) => r.id)).toEqual(["m1", "m0"]);
    expect(historyTotals(rows)).toEqual({ earned: 5 * 599, took: 5, sent: 2 });
  });

  it("keeps a new count only for offers Fanvue still lists", async () => {
    const snapshot = await snapshotWith([promotion("p1", 5, winback.endsAt)]);
    const updates = usageUpdates([winback, { ...winback, id: "m2", promotionUuid: "gone" }], snapshot);
    expect(updates).toEqual([{ ...winback, used: 5 }]);
  });
});

describe("the demo history", () => {
  it("shows Maya's past result, then what was sent in this session", async () => {
    const sent: DemoSend[] = [
      {
        kind: "winback",
        approach: "free-week-back",
        at: "2026-09-25T11:00:00Z",
        recipients: 178,
        offer: { type: "trial", days: 7 },
        endsAt: "2026-10-02T23:59:59Z",
      },
    ];
    const source = createFixtureSource({ persona: "maya", now: () => now, sent: sent });
    const snapshot = await source.getSnapshot();
    const rows = historyRows(demoHistory("maya", sent, snapshot, now), snapshot, now);

    expect(rows[0]).toMatchObject({ status: "live", result: "Nobody's used it yet" });
    expect(rows.find((r) => r.id === "demo-past-winback")).toMatchObject({
      status: "ended",
      result: "17 fans came back",
      earned: 17 * 699,
    });
  });

  it("is empty for a brand new account", async () => {
    const snapshot = await createFixtureSource({ persona: "day-one", now: () => now }).getSnapshot();
    expect(demoHistory("day-one", [], snapshot, now)).toEqual([]);
  });
});

describe("a live creator's history when the store is down", () => {
  it("says it couldn't be read, instead of 'nothing sent yet'", async () => {
    const { liveHistory } = await import("@/server/load-history");
    const { createMemoryStore } = await import("@/lib/store");
    const down = { ...createMemoryStore(), getFields: () => Promise.reject(new Error("down")) };
    const snapshot = await snapshotWith([]);
    expect(await liveHistory(down, snapshot, now)).toMatchObject({ rows: [], unreadable: true, recording: true });
  });

  it("reads back what was saved, and keeps Fanvue's newest count", async () => {
    const { liveHistory } = await import("@/server/load-history");
    const { createMemoryStore } = await import("@/lib/store");
    const { saveEntry, loadEntries } = await import("./log");
    const store = createMemoryStore();
    const snapshot = await snapshotWith([promotion("p1", 6, winback.endsAt)]);
    await saveEntry(store, snapshot.creator.uuid, winback);

    const history = await liveHistory(store, snapshot, now);
    expect(history).toMatchObject({ unreadable: false, recording: true, totals: { took: 6 } });
    expect((await loadEntries(store, snapshot.creator.uuid))[0]!.used).toBe(6);
  });
});
