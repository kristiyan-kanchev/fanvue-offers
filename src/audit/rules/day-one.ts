import { smartListCount, type CreatorSnapshot } from "@/data/types";
import { formatPrice } from "@/lib/format";
import type { DayOneItem, DayOneReport } from "../types";
import { isTrialLinkLive, subscriptionPrice } from "./helpers";

/** No subscribers and no followers: nothing is leaking yet, so the page gets set up instead. */
export function isDayOne(snapshot: CreatorSnapshot): boolean {
  return smartListCount(snapshot, "subscribers") === 0 && smartListCount(snapshot, "followers") === 0;
}

export function dayOneReport(snapshot: CreatorSnapshot, now = new Date()): DayOneReport {
  const cents = subscriptionPrice(snapshot);
  const welcome = snapshot.automatedMessages.ok
    ? snapshot.automatedMessages.data.find((m) => m.trigger === "new_subscriber" && m.enabled)
    : undefined;
  const link = snapshot.freeTrialLinks.ok
    ? snapshot.freeTrialLinks.data.find((l) => isTrialLinkLive(l, now))
    : undefined;

  const items: DayOneItem[] = [
    {
      id: "price",
      label: "Set your price",
      done: cents !== null,
      why: "What a month of your page costs. With no subscribers yet, changing it affects nobody.",
      ...(cents !== null && { detail: `${formatPrice(cents)} a month` }),
    },
    {
      id: "welcome",
      label: "Turn on a welcome message",
      done: Boolean(welcome),
      why: "Every new subscriber gets it the moment they join, so nobody lands on a quiet page.",
      ...(welcome?.text && { detail: welcome.text }),
    },
    {
      id: "trial-link",
      label: "Make a free trial link",
      done: Boolean(link),
      why: "A link you can share anywhere that lets people try your page before they pay.",
      ...(link?.trialDurationDays && { detail: `${link.trialDurationDays} days free` }),
      ...(link?.url && { url: link.url }),
    },
  ];

  return { items, completedCount: items.filter((item) => item.done).length };
}
