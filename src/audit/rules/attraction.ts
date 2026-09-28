import { smartListCount, type Promotion } from "@/data/types";
import type { Rule } from "../types";
import { isTrialLinkLive, livePromotions } from "./helpers";

/** Is there a way in: a free trial or an offer for people who follow but don't pay? */

const FRONT_DOOR_GROUPS = new Set<Promotion["availableToGroup"]>(["new_subscribers", "followers", "all"]);

export const attractionNoFrontDoor: Rule = (snapshot, now) => {
  const id = "attraction.no-front-door";
  const subscribers = smartListCount(snapshot, "subscribers");
  const followers = smartListCount(snapshot, "followers");
  const promotions = livePromotions(snapshot, now);
  const links = snapshot.freeTrialLinks;
  if (subscribers === null || followers === null || promotions === null || !links.ok) {
    return { id, severity: "unavailable" };
  }

  const hasWayIn =
    links.data.some((link) => isTrialLinkLive(link, now)) ||
    promotions.some((promotion) => FRONT_DOOR_GROUPS.has(promotion.availableToGroup));
  if (hasWayIn || followers === 0) return { id, severity: "ok" };

  return {
    id,
    severity: followers >= subscribers ? "high" : "medium",
    action: { kind: "front-door", recipients: followers },
  };
};
