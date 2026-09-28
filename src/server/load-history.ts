import type { CreatorData, CreatorSnapshot } from "@/data/types";
import { demoHistory } from "@/history/demo";
import { historyRows, historyTotals, usageUpdates, type HistoryRow, type HistoryTotals } from "@/history/history";
import { loadEntries, saveEntry } from "@/history/log";
import { getStore, type Store } from "@/lib/store";

export interface History {
  rows: HistoryRow[];
  totals: HistoryTotals;
  /** False when a live account has nowhere to keep what it sends. */
  recording: boolean;
  /** The log couldn't be read just now, so an empty list doesn't mean nothing was sent. */
  unreadable: boolean;
}

/** Every fix sent through the app, with how each is doing. */
export async function loadHistory(data: CreatorData, snapshot: CreatorSnapshot, now: Date): Promise<History> {
  if (data.mode === "live") return liveHistory(getStore(), snapshot, now);
  const rows = historyRows(demoHistory(data.persona, data.sent, snapshot, now), snapshot, now);
  return { rows, totals: historyTotals(rows), recording: true, unreadable: false };
}

/**
 * A live creator's history: the log from the store, results from the snapshot.
 * Each count Fanvue still shows is written back, so a result outlives its offer.
 */
export async function liveHistory(store: Store | null, snapshot: CreatorSnapshot, now: Date): Promise<History> {
  let unreadable = false;
  const entries = await loadEntries(store, snapshot.creator.uuid).catch(() => {
    unreadable = true;
    return [];
  });
  await Promise.all(usageUpdates(entries, snapshot).map((entry) => saveEntry(store, snapshot.creator.uuid, entry)));
  const rows = historyRows(entries, snapshot, now);
  return { rows, totals: historyTotals(rows), recording: store !== null, unreadable };
}
