import { FanvueApiError, type FanvueClient, type RequestOptions } from "@/fanvue/client";
import { createFixtureSource } from "@/data/fixture-source";
import {
  available,
  unavailable,
  type CreatorSnapshot,
  type MassMessageStats,
  type SmartListId,
} from "@/data/types";

/** The Coach Maya snapshot, straight from the demo fixtures. */
export function mayaSnapshot(): Promise<CreatorSnapshot> {
  return createFixtureSource().getSnapshot();
}

/** A free mass message Fanvue has on record as sent to one smart list. */
export function sentTo(list: SmartListId, at: string, status: MassMessageStats["status"] = "SENT"): MassMessageStats {
  return {
    uuid: `sent-${list}-${at}`,
    status,
    price: null,
    recipientCount: 100,
    purchaseCount: 0,
    totalRevenue: 0,
    createdAt: at,
    publishedAt: at,
    scheduledAt: null,
    smartListIds: [list],
  };
}

export function markUnavailable<K extends keyof CreatorSnapshot>(
  snapshot: CreatorSnapshot,
  key: K,
  error = "upstream 500",
): CreatorSnapshot {
  return { ...snapshot, [key]: unavailable(error) as CreatorSnapshot[K] };
}

/**
 * A creator with every rung healthy: a front door, a live win-back
 * offer, low auto-renew churn and flat weekly churn.
 */
export async function healthySnapshot(): Promise<CreatorSnapshot> {
  const base = await mayaSnapshot();
  return {
    ...base,
    smartLists: available([
      { name: "Subscribers", uuid: "subscribers", count: 1250 },
      { name: "Auto-renewing", uuid: "auto_renewing", count: 1180 },
      { name: "Non-renewing", uuid: "non_renewing", count: 70 },
      { name: "Followers", uuid: "followers", count: 900 },
      { name: "Free trial subscribers", uuid: "free_trial_subscribers", count: 0 },
      { name: "Expired subscribers", uuid: "expired_subscribers", count: 180 },
      { name: "Spent more than $50", uuid: "spent_more_than_50", count: 423 },
      { name: "Muted", uuid: "muted", count: 61 },
      { name: "Creators", uuid: "creators", count: 44 },
    ]),
    freeTrialLinks: available([
      {
        uuid: "11111111-1111-4111-8111-111111111111",
        url: "https://fanvue.com/coachmaya?trial=1",
        maxUsages: null,
        name: "7 day trial",
        usedCount: 12,
        trialDurationDays: 7,
        expiresAt: null,
        createdAt: "2026-01-04T09:00:00Z",
      },
    ]),
    promotions: available([
      {
        uuid: "22222222-2222-4222-8222-222222222222",
        type: "discount",
        discountPercent: 35,
        freeTrialDays: null,
        availableToGroup: "expired_subscribers",
        endsAt: "2026-12-31T23:59:59Z",
        maxUsages: null,
        usedCount: 9,
        message: "Come back for less.",
        createdAt: "2026-08-01T09:00:00Z",
      },
    ]),
    retention: available(
      base.retention.ok
        ? base.retention.data.map((snapshot) => ({
            ...snapshot,
            paidFanChurnRate: 0.03,
          }))
        : [],
    ),
  };
}

/** A brand new account: no subscribers, no followers, nothing set up. */
export async function emptySnapshot(): Promise<CreatorSnapshot> {
  const base = await mayaSnapshot();
  return {
    ...base,
    creator: {
      uuid: "empty",
      displayName: "New Creator",
      handle: "newcreator",
      avatarUrl: null,
      bannerUrl: null,
      subscriptionPrice: null,
      voiceSamples: [],
    },
    smartLists: available([
      { name: "Subscribers", uuid: "subscribers", count: 0 },
      { name: "Auto-renewing", uuid: "auto_renewing", count: 0 },
      { name: "Non-renewing", uuid: "non_renewing", count: 0 },
      { name: "Followers", uuid: "followers", count: 0 },
      { name: "Free trial subscribers", uuid: "free_trial_subscribers", count: 0 },
      { name: "Expired subscribers", uuid: "expired_subscribers", count: 0 },
      { name: "Spent more than $50", uuid: "spent_more_than_50", count: 0 },
      { name: "Muted", uuid: "muted", count: 0 },
      { name: "Creators", uuid: "creators", count: 0 },
    ]),
    freeTrialLinks: available([]),
    promotions: available([]),
    automatedMessages: available(
      base.automatedMessages.ok
        ? base.automatedMessages.data.map((message) => ({
            ...message,
            enabled: false,
            updatedAt: null,
          }))
        : [],
    ),
  };
}

interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

/** A FanvueClient that records its calls and answers from a script. */
export function fakeClient(
  responder: (call: RecordedCall, index: number) => { status: number; body?: unknown },
): { client: FanvueClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const request =
    (method: string) =>
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      const call = { method, path, body: options.body, headers: options.headers ?? {} };
      calls.push(call);
      const { status, body } = responder(call, calls.length - 1);
      if (status >= 400) {
        const message =
          body && typeof body === "object" && "message" in body ? String(body.message) : `stub ${status}`;
        throw new FanvueApiError({ status, message, body });
      }
      return body as T;
    };

  return {
    calls,
    client: { get: request("GET"), post: request("POST"), put: request("PUT"), patch: request("PATCH") },
  };
}
