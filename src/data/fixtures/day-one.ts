// Fixtures for the second demo creator: an account with nothing in it yet.
// Shapes are checked against src/fanvue/schema.d.ts, so a mismatch fails tsc.
import type {
  AutomatedMessage,
  FanvueAccount,
  UnsubscribeReasons,
} from "@/data/types";

export const creator = {
  displayName: "Sam Okonjo",
  handle: "samokonjo",
  bio: "Just getting started. Strength coaching for beginners.",
};

/**
 * Sam has not set a subscription price yet, which is the case the spec's
 * nullable `subscriptionPrice` exists for. The audit never shows a money figure
 * for him: an unknown price is not a zero price.
 */
export const account = {
  uuid: "3c6e9a1d-4f7b-4e2a-9d8c-1b5f0e7a2c94",
  email: "sam@samokonjo.example",
  handle: creator.handle,
  displayName: creator.displayName,
  isCreator: true,
  isAiCreator: false,
  createdAt: "2026-09-20T09:00:00Z",
  updatedAt: "2026-09-20T09:15:00Z",
  avatarUrl: null,
  bannerUrl: null,
  bio: creator.bio,
  account: {
    status: "active",
    subscriptionPrice: null,
    earnings: { total: 0, availableBalance: 0, lastPayoutAt: null },
    fans: { followers: 0, subscribers: 0 },
  },
} satisfies FanvueAccount;

export const unsubscribeReasons = {
  reasons: [],
  currentWeekTotal: 0,
  rollingTotal: 0,
} satisfies UnsubscribeReasons;

/**
 * Sam has set up nothing: no price, no welcome message, no trial link. That is
 * the state the welcome flow starts from.
 */
export const automatedMessages = [
  {
    trigger: "new_subscriber",
    enabled: false,
    text: null,
    price: null,
    mediaUuids: [],
    mediaPreviewUuid: null,
    updatedAt: null,
  },
] satisfies AutomatedMessage[];
