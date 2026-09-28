import { audit } from "@/audit/audit";
import { tellStory, type Story } from "@/audit/story";
import type { AuditReport } from "@/audit/types";
import { requireCreatorData } from "@/data/get-source";
import { smartListCount, type CreatorSnapshot } from "@/data/types";
import { loadHistory, type History } from "./load-history";

export interface AuditPayload {
  mode: "live" | "demo";
  /** Only this much of the creator reaches the browser. */
  creator: {
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    subscribers: number | null;
    followers: number | null;
  };
  fetchedAt: string;
  report: AuditReport;
  story: Story;
  /** What was sent through the app, and how it's doing. */
  history: History;
  /** Some of Fanvue's data didn't load, so some checks were skipped. */
  incomplete: boolean;
}

const PARTS = [
  "smartLists",
  "promotions",
  "freeTrialLinks",
  "retention",
  "unsubscribeReasons",
  "automatedMessages",
  "massMessages",
] as const satisfies (keyof CreatorSnapshot)[];

export async function loadAuditPayload(force = false): Promise<AuditPayload> {
  const data = await requireCreatorData({ force });
  const snapshot = await data.getSnapshot();
  const now = new Date();
  const report = audit(snapshot, now);
  const { creator } = snapshot;

  return {
    mode: data.mode,
    creator: {
      displayName: creator.displayName,
      handle: creator.handle,
      avatarUrl: creator.avatarUrl,
      bannerUrl: creator.bannerUrl,
      subscribers: smartListCount(snapshot, "subscribers"),
      followers: smartListCount(snapshot, "followers"),
    },
    fetchedAt: snapshot.fetchedAt,
    report,
    story: tellStory(report, snapshot, now),
    history: await loadHistory(data, snapshot, now),
    incomplete: PARTS.some((part) => !snapshot[part].ok),
  };
}
