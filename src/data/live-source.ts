import { FanvueApiError, type FanvueClient } from "@/fanvue/client";
import { getJson } from "@/fanvue/typed";
import {
  AccountShape,
  AutomatedMessagesShape,
  checked,
  FreeTrialLinksShape,
  MassMessagesShape,
  PromotionsShape,
  RetentionShape,
  SmartListsShape,
  UnsubscribeReasonsShape,
} from "./shapes";
import type { ZodType } from "zod";
import {
  available,
  massMessageStats,
  unavailable,
  voiceSamplesFrom,
  type CreatorData,
  type CreatorSnapshot,
  type SnapshotPart,
} from "./types";

const RETENTION_WEEKS = 8;
const MASS_MESSAGE_PAGE_SIZE = 50;
const SNAPSHOT_TTL_MS = 60_000;

/**
 * One read, checked against the fields the rules use. A failure marks just this
 * part unavailable; an expired login is rethrown so the creator can reconnect.
 */
async function part<R, T>(
  label: string,
  shape: ZodType,
  load: () => Promise<R>,
  pick: (response: R) => T,
): Promise<SnapshotPart<T>> {
  try {
    return available(pick(checked(shape, await load())));
  } catch (cause) {
    if (cause instanceof FanvueApiError && cause.needsReconnect) throw cause;
    const status = cause instanceof FanvueApiError ? ` (${cause.status})` : "";
    return unavailable(`${label} could not be read${status}: ${(cause as Error).message}`);
  }
}

export function createSnapshotCache(ttlMs = SNAPSHOT_TTL_MS) {
  const entries = new Map<string, { at: number; snapshot: CreatorSnapshot }>();

  return {
    async get(creatorUuid: string, load: () => Promise<CreatorSnapshot>, now: number, force = false) {
      const hit = entries.get(creatorUuid);
      if (!force && hit && now - hit.at < ttlMs) return hit.snapshot;
      const snapshot = await load();
      entries.set(creatorUuid, { at: now, snapshot });
      return snapshot;
    },
    invalidate(creatorUuid: string) {
      entries.delete(creatorUuid);
    },
  };
}

/** Per server process, keyed by creator. */
export const snapshotCache = createSnapshotCache();

interface LiveSourceOptions {
  client: FanvueClient;
  cache?: ReturnType<typeof createSnapshotCache>;
  now?: () => number;
  /** Skip the cache: Check again, and anything about to send. */
  force?: boolean;
}

/** The real Fanvue API, every read in parallel. Only counts and aggregates leave this module. */
export function createLiveSource({ client, cache = snapshotCache, now = Date.now, force = false }: LiveSourceOptions): CreatorData {
  async function load(identity: CreatorSnapshot["creator"]): Promise<CreatorSnapshot> {
    const [
      price,
      smartLists,
      promotions,
      freeTrialLinks,
      retention,
      unsubscribeReasons,
      automatedMessages,
      recentMessages,
    ] = await Promise.all([
      part("Your subscription price", AccountShape, () => getJson(client, "/users/account"), (r) => r.account.subscriptionPrice ?? null),
      part("Your subscriber lists", SmartListsShape, () => getJson(client, "/chats/lists/smart"), (r) => r),
      part("Your promotions", PromotionsShape, () => getJson(client, "/promotions"), (r) => r.data),
      part("Your free trial links", FreeTrialLinksShape, () => getJson(client, "/free-trial-links"), (r) => r.data),
      part(
        "Your retention history",
        RetentionShape,
        () => getJson(client, "/insights/fan-retention-summary", { periods: RETENTION_WEEKS }),
        (r) => r.snapshots,
      ),
      part("Your exit survey reasons", UnsubscribeReasonsShape, () => getJson(client, "/insights/unsubscribe-reasons"), (r) => r),
      part("Your automated messages", AutomatedMessagesShape, () => getJson(client, "/chats/automated-messages"), (r) => r.data),
      part(
        "Your mass message results",
        MassMessagesShape,
        () => getJson(client, "/chats/mass-messages", { size: MASS_MESSAGE_PAGE_SIZE }),
        (r) => r.data,
      ),
    ]);

    return {
      creator: {
        ...identity,
        // Unknown rather than zero: findings fall back to counts.
        subscriptionPrice: price.ok ? price.data : null,
        voiceSamples: recentMessages.ok ? voiceSamplesFrom(recentMessages.data) : [],
      },
      smartLists,
      promotions,
      freeTrialLinks,
      retention,
      unsubscribeReasons,
      automatedMessages,
      // The text is dropped here: only counts and list names are kept.
      massMessages: recentMessages.ok ? available(recentMessages.data.map(massMessageStats)) : recentMessages,
      fetchedAt: new Date(now()).toISOString(),
    };
  }

  return {
    mode: "live",
    async getSnapshot() {
      const me = await getJson(client, "/users/me");
      const identity = {
        uuid: me.uuid,
        displayName: me.displayName ?? me.handle ?? "your account",
        handle: me.handle ?? "",
        ...(me.bio && { bio: me.bio }),
        avatarUrl: me.avatarUrl ?? null,
        bannerUrl: me.bannerUrl ?? null,
        subscriptionPrice: null,
        voiceSamples: [],
      };
      return cache.get(me.uuid, () => load(identity), now(), force);
    },
  };
}
