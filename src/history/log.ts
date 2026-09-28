import "server-only";

import type { ActionPlan } from "@/actions/plan";
import type { Store } from "@/lib/store";
import type { HistoryEntry } from "./history";

const key = (creatorUuid: string) => `history:${creatorUuid}`;

/** The entry for a fix Fanvue has just accepted. */
export function entryFromSend(
  plan: ActionPlan,
  sent: { massMessageUuid: string; promotionUuid: string | null; recipientCount: number; automated: boolean },
  price: number | null,
  now: Date,
): HistoryEntry {
  return {
    id: sent.massMessageUuid,
    kind: plan.kind,
    approach: plan.approach,
    sentAt: now.toISOString(),
    recipients: sent.recipientCount,
    offer: plan.offer,
    endsAt: plan.endsAt,
    promotionUuid: sent.promotionUuid,
    price,
    automated: sent.automated,
    used: plan.offer ? 0 : null,
  };
}

/** Saves an entry, or replaces it by id. A failure is swallowed: the fix has already gone. */
export async function saveEntry(store: Store | null, creatorUuid: string, entry: HistoryEntry): Promise<void> {
  if (!store) return;
  try {
    await store.setField(key(creatorUuid), entry.id, JSON.stringify(entry));
  } catch {
    // History is a record of what happened, not a part of it.
  }
}

export async function loadEntries(store: Store | null, creatorUuid: string): Promise<HistoryEntry[]> {
  if (!store) return [];
  const fields = await store.getFields(key(creatorUuid));
  return Object.values(fields).flatMap((raw) => {
    try {
      return [JSON.parse(raw) as HistoryEntry];
    } catch {
      return [];
    }
  });
}
