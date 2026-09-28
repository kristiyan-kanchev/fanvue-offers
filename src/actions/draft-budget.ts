import type { Store } from "@/lib/store";

/** A fixed window that opens with the first draft and lasts an hour. */
export const BUDGET_WINDOW_SECONDS = 60 * 60;

/**
 * Whose hourly budget a draft spends: everyone in the demo shares one, and each
 * connected creator has their own, so a demo visitor can't use up a creator's.
 */
export type DraftBudget = "demo" | { creator: string };

export function budgetFor(mode: "live" | "demo", creatorUuid: string): DraftBudget {
  return mode === "demo" ? "demo" : { creator: creatorUuid };
}

const budgetKey = (budget: DraftBudget) =>
  budget === "demo" ? "drafts:budget:demo" : `drafts:budget:creator:${budget.creator}`;

/** Spends one draft. Fails closed: with no store, or one that can't be reached, the model isn't called. */
export async function takeDraftBudget(store: Store | null, limit: number, budget: DraftBudget = "demo"): Promise<boolean> {
  if (!store || limit <= 0) return false;
  try {
    return (await store.increment(budgetKey(budget), BUDGET_WINDOW_SECONDS)) <= limit;
  } catch {
    return false;
  }
}
