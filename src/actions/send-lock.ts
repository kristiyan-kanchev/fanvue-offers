import "server-only";

import type { ActionKind } from "@/audit/types";
import type { Store } from "@/lib/store";
import { AUDIENCE } from "./plan";

/**
 * Kept after a success, so a request that read Fanvue just before that send is
 * still turned away; after it expires, Fanvue's record of the message holds the list.
 */
export const SEND_LOCK_SECONDS = 5 * 60;

const key = (creatorUuid: string, kind: ActionKind) => `send:${creatorUuid}:${AUDIENCE[kind]}`;

type SendLock = { held: true; release: () => Promise<void> } | { held: false };

/** Without a working store, the send goes ahead on the weekly check alone rather than blocking every fix. */
export async function claimSend(store: Store | null, creatorUuid: string, kind: ActionKind): Promise<SendLock> {
  const noop = { held: true as const, release: async () => {} };
  if (!store) return noop;
  const k = key(creatorUuid, kind);
  try {
    if (!(await store.claim(k, SEND_LOCK_SECONDS))) return { held: false };
  } catch {
    return noop;
  }
  return { held: true, release: () => store.remove(k).catch(() => undefined) };
}
