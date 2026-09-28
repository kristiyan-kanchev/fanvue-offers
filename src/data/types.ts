import type { ApproachId } from "@/actions/approaches";
import type { Offer } from "@/actions/plan";
import type { ActionKind } from "@/audit/types";
import type { paths } from "@/fanvue/schema";

type Json<R> = R extends { content: { "application/json": infer J } } ? J : never;
type GetOk<P extends keyof paths> = paths[P] extends { get: { responses: { 200: infer R } } } ? Json<R> : never;

export type FanvueUser = GetOk<"/users/me">;
export type FanvueAccount = GetOk<"/users/account">;
export type SmartList = GetOk<"/chats/lists/smart">[number];
export type SmartListId = SmartList["uuid"];
export type Promotion = GetOk<"/promotions">["data"][number];
export type FreeTrialLink = GetOk<"/free-trial-links">["data"][number];
export type RetentionSnapshot = GetOk<"/insights/fan-retention-summary">["snapshots"][number];
export type UnsubscribeReasons = GetOk<"/insights/unsubscribe-reasons">;
export type AutomatedMessage = GetOk<"/chats/automated-messages">["data"][number];
export type MassMessage = GetOk<"/chats/mass-messages">["data"][number];

export type PromotionCreateBody = NonNullable<paths["/promotions"]["post"]["requestBody"]>["content"]["application/json"];
export type MassMessageCreateBody = paths["/chats/mass-messages"]["post"]["requestBody"]["content"]["application/json"];

/** What's kept from a mass message: counts and which lists it went to, never its text or media. */
export type MassMessageStats = Pick<
  MassMessage,
  "uuid" | "status" | "price" | "recipientCount" | "purchaseCount" | "totalRevenue" | "createdAt" | "publishedAt" | "scheduledAt"
> & { smartListIds: SmartListId[] };

export function massMessageStats(message: MassMessage): MassMessageStats {
  const { uuid, status, price, recipientCount, purchaseCount, totalRevenue, createdAt, publishedAt, scheduledAt } = message;
  return {
    uuid,
    status,
    price,
    recipientCount,
    purchaseCount,
    totalRevenue,
    createdAt,
    publishedAt,
    scheduledAt,
    // Required by the spec, but one odd message mustn't fail the whole read.
    smartListIds: message.includedLists?.smartListIds ?? [],
  };
}

const VOICE_SAMPLE_COUNT = 3;
const VOICE_SAMPLE_MIN_CHARS = 20;
const VOICE_SAMPLE_MAX_CHARS = 280;

/** The creator's own words from their last few broadcasts, so a draft sounds like them. Never stored. */
export function voiceSamplesFrom(messages: MassMessage[]): string[] {
  return messages
    .map((message) => (message.status === "SENT" ? (message.text?.trim() ?? "") : ""))
    .filter((text) => text.length >= VOICE_SAMPLE_MIN_CHARS)
    .slice(0, VOICE_SAMPLE_COUNT)
    .map((text) => text.slice(0, VOICE_SAMPLE_MAX_CHARS));
}

/** A read that may have failed. Rules that need a failed part say so instead of guessing. */
export type SnapshotPart<T> = { ok: true; data: T } | { ok: false; error: string };

export const available = <T,>(data: T): SnapshotPart<T> => ({ ok: true, data });
export const unavailable = <T,>(error: string): SnapshotPart<T> => ({ ok: false, error });

export interface CreatorSnapshot {
  creator: {
    uuid: string;
    displayName: string;
    handle: string;
    bio?: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    /** USD cents. Null when unset or unreadable, so findings fall back to counts rather than showing $0. */
    subscriptionPrice: number | null;
    voiceSamples: string[];
  };
  smartLists: SnapshotPart<SmartList[]>;
  promotions: SnapshotPart<Promotion[]>;
  freeTrialLinks: SnapshotPart<FreeTrialLink[]>;
  /** Weekly, most recent first. */
  retention: SnapshotPart<RetentionSnapshot[]>;
  unsubscribeReasons: SnapshotPart<UnsubscribeReasons>;
  automatedMessages: SnapshotPart<AutomatedMessage[]>;
  massMessages: SnapshotPart<MassMessageStats[]>;
  fetchedAt: string;
}

/** Maya is an established coach with money left on the table; day-one has just signed up. */
export const DEMO_PERSONAS = ["maya", "day-one"] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];

/** A demo dry run, kept in the session and laid over the fixtures as Fanvue would show it. */
export interface DemoSend {
  kind: ActionKind;
  approach?: ApproachId;
  at: string;
  recipients: number;
  offer: Offer | null;
  endsAt: string | null;
  /** Set when the renewal message was also made the automatic reminder. */
  automatedText?: string;
}

/** What the demo creator set up in the welcome flow. */
export interface DemoSetup {
  price?: number;
  welcome?: string;
  trialDays?: number;
}

export type CreatorData =
  | { readonly mode: "live"; getSnapshot(): Promise<CreatorSnapshot> }
  | { readonly mode: "demo"; persona: DemoPersona; sent: DemoSend[]; getSnapshot(): Promise<CreatorSnapshot> };

/** Null when the lists couldn't be read; 0 when the list isn't there. */
export function smartListCount(snapshot: CreatorSnapshot, id: SmartListId): number | null {
  if (!snapshot.smartLists.ok) return null;
  return snapshot.smartLists.data.find((list) => list.uuid === id)?.count ?? 0;
}
