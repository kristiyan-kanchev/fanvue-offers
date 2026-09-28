import { AUDIENCE, OFFER_GROUP } from "@/actions/plan";
import {
  available,
  massMessageStats,
  voiceSamplesFrom,
  type AutomatedMessage,
  type CreatorData,
  type CreatorSnapshot,
  type DemoPersona,
  type DemoSend,
  type DemoSetup,
  type MassMessageStats,
  type Promotion,
} from "./types";
import account from "./fixtures/maya/account";
import automatedMessages from "./fixtures/maya/automated-messages";
import creator from "./fixtures/maya/creator";
import fanRetentionSummary from "./fixtures/maya/fan-retention-summary";
import freeTrialLinks from "./fixtures/maya/free-trial-links";
import massMessages from "./fixtures/maya/mass-messages";
import promotions from "./fixtures/maya/promotions";
import smartLists from "./fixtures/maya/smart-lists";
import unsubscribeReasons from "./fixtures/maya/unsubscribe-reasons";
import * as dayOne from "./fixtures/day-one";

const DEMO_CREATOR_UUID = "demo";

export const demoTrialLinkUrl = (handle: string) => `https://www.fanvue.com/${handle}?trial=demo`;

function mayaSnapshot(now: Date): CreatorSnapshot {
  return {
    creator: {
      uuid: DEMO_CREATOR_UUID,
      displayName: creator.displayName,
      handle: creator.handle,
      bio: creator.bio,
      avatarUrl: creator.avatarUrl,
      bannerUrl: creator.bannerUrl,
      subscriptionPrice: account.account.subscriptionPrice,
      voiceSamples: voiceSamplesFrom(massMessages.data),
    },
    smartLists: available(smartLists),
    promotions: available(promotions.data),
    freeTrialLinks: available(freeTrialLinks.data),
    retention: available(fanRetentionSummary.snapshots),
    unsubscribeReasons: available(unsubscribeReasons),
    automatedMessages: available(automatedMessages.data),
    massMessages: available(massMessages.data.map(massMessageStats)),
    fetchedAt: now.toISOString(),
  };
}

/** No subscribers and no followers: the endpoints answer, with nothing in them. */
function dayOneSnapshot(now: Date): CreatorSnapshot {
  return {
    creator: {
      uuid: DEMO_CREATOR_UUID,
      displayName: dayOne.creator.displayName,
      handle: dayOne.creator.handle,
      bio: dayOne.creator.bio,
      avatarUrl: dayOne.account.avatarUrl,
      bannerUrl: dayOne.account.bannerUrl,
      subscriptionPrice: dayOne.account.account.subscriptionPrice,
      voiceSamples: [],
    },
    smartLists: available([]),
    promotions: available([]),
    freeTrialLinks: available([]),
    retention: available([]),
    unsubscribeReasons: available(dayOne.unsubscribeReasons),
    automatedMessages: available(dayOne.automatedMessages),
    massMessages: available([]),
    fetchedAt: now.toISOString(),
  };
}

function automatedMessage(trigger: AutomatedMessage["trigger"], text: string): AutomatedMessage {
  return { trigger, enabled: true, text, price: null, mediaUuids: [], mediaPreviewUuid: null, updatedAt: null };
}

function withAutomatedMessage(snapshot: CreatorSnapshot, message: AutomatedMessage): CreatorSnapshot {
  if (!snapshot.automatedMessages.ok) return snapshot;
  const others = snapshot.automatedMessages.data.filter((m) => m.trigger !== message.trigger);
  return { ...snapshot, automatedMessages: available([message, ...others]) };
}

function promotionFor(send: DemoSend): Promotion[] {
  const group = OFFER_GROUP[send.kind];
  if (!send.offer || !group) return [];
  const discount = send.offer.type === "discount";
  return [
    {
      uuid: `demo-${send.kind}-${send.at}`,
      type: discount ? "discount" : "free_trial",
      discountPercent: send.offer.type === "discount" ? send.offer.percent : null,
      freeTrialDays: send.offer.type === "trial" ? send.offer.days : null,
      availableToGroup: group,
      endsAt: send.endsAt,
      maxUsages: null,
      usedCount: 0,
      message: null,
      createdAt: send.at,
    },
  ];
}

function messageFor(send: DemoSend): MassMessageStats {
  return {
    uuid: `demo-message-${send.kind}-${send.at}`,
    status: "SENT",
    price: null,
    recipientCount: send.recipients,
    purchaseCount: 0,
    totalRevenue: 0,
    createdAt: send.at,
    publishedAt: send.at,
    scheduledAt: null,
    smartListIds: [AUDIENCE[send.kind]],
  };
}

/** The demo's dry runs, shown as Fanvue would after a real send: the offer live, the list messaged. */
function withDemoSends(snapshot: CreatorSnapshot, sent: DemoSend[]): CreatorSnapshot {
  if (sent.length === 0) return snapshot;
  let next: CreatorSnapshot = {
    ...snapshot,
    promotions: snapshot.promotions.ok
      ? available([...sent.flatMap(promotionFor), ...snapshot.promotions.data])
      : snapshot.promotions,
    massMessages: snapshot.massMessages.ok
      ? available([...sent.map(messageFor), ...snapshot.massMessages.data])
      : snapshot.massMessages,
  };
  const reminder = sent.findLast((send) => send.automatedText)?.automatedText;
  if (reminder) next = withAutomatedMessage(next, automatedMessage("subscription_canceled", reminder));
  return next;
}

/** The demo's welcome-flow choices, shown as Fanvue would after the real calls. */
function withDemoSetup(snapshot: CreatorSnapshot, setup: DemoSetup): CreatorSnapshot {
  let next = snapshot;
  if (setup.price !== undefined) {
    next = { ...next, creator: { ...next.creator, subscriptionPrice: setup.price } };
  }
  if (setup.welcome !== undefined) {
    next = withAutomatedMessage(next, automatedMessage("new_subscriber", setup.welcome));
  }
  if (setup.trialDays !== undefined && next.freeTrialLinks.ok) {
    const link = {
      uuid: "demo-trial-link",
      url: demoTrialLinkUrl(next.creator.handle),
      maxUsages: null,
      name: "Offers",
      usedCount: 0,
      trialDurationDays: setup.trialDays,
      expiresAt: null,
      createdAt: next.fetchedAt,
    };
    next = { ...next, freeTrialLinks: available([link, ...next.freeTrialLinks.data]) };
  }
  return next;
}

/** The demo's data: local fixtures, no network, and every action a dry run. */
export function createFixtureSource({
  persona = "maya",
  now = () => new Date(),
  sent = [],
  setup = {},
}: { persona?: DemoPersona; now?: () => Date; sent?: DemoSend[]; setup?: DemoSetup } = {}): CreatorData {
  return {
    mode: "demo",
    persona,
    sent,
    async getSnapshot() {
      const base = persona === "day-one" ? dayOneSnapshot(now()) : mayaSnapshot(now());
      return withDemoSetup(withDemoSends(base, sent), setup);
    },
  };
}
