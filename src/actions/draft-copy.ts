import { formatDate } from "@/lib/format";
import type { ApproachId } from "./approaches";
import type { Offer } from "./plan";

// The words of a draft: the built-in wording for each approach, and the prompt
// the model writes from. Only the creator's own details, never a fan's.

/** Fanvue allows 5,000 characters in a mass message; a fix message should be short. */
export const MAX_DRAFT_CHARS = 500;

/** An approach to a fix, or the welcome message a new account sets up. */
export type DraftKind = ApproachId | "welcome";

export interface DraftInput {
  approach: DraftKind;
  creatorName: string;
  bio?: string;
  /** The creator's own recent broadcasts: never a fan's words, never a DM. */
  voiceSamples: string[];
  recipientCount: number;
  offer: Offer | null;
  endsAt: string | null;
  /** The top exit-survey reason, like "price". */
  topUnsubscribeReason?: string | null;
}

function offerWords({ offer, endsAt }: DraftInput) {
  return {
    off: offer?.type === "discount" ? `${offer.percent}% off` : "",
    free: offer?.type === "trial" ? `${offer.days} days free` : "",
    until: endsAt ? formatDate(endsAt) : "",
  };
}

/** Used without a model, and whenever the model can't be used. Every claim is one the plan makes true. */
export function templateDraft(input: DraftInput): string {
  const { off, free, until } = offerWords(input);
  const hi = `Hey, it's ${input.creatorName}.`;
  switch (input.approach) {
    case "comeback-discount":
      return [
        hi,
        "I'd love to have you back.",
        input.topUnsubscribeReason === "price"
          ? `A lot of you told me price was the reason you left, so this one is ${off} your next month.`
          : `I've set up ${off} your next month.`,
        `It's on your account until ${until}. No pressure either way, and thanks for the time you spent here.`,
      ].join(" ");
    case "free-week-back":
      return [
        hi,
        "It's been a while, so I've set up",
        `${free} if you want to come back and see what you've missed.`,
        `It's open until ${until}. No pressure either way.`,
      ].join(" ");
    case "just-ask":
      return [
        hi,
        "It's been a while since you were here, and I'd love to have you back.",
        "[Say one thing you've posted or changed since they left.]",
        "Your spot's still here whenever you want it.",
      ].join(" ");
    case "free-trial":
      return [
        hi,
        "Thanks for following.",
        `If you've wondered what's behind the subscription, you can try it with ${free}.`,
        `The trial is open until ${until}.`,
      ].join(" ");
    case "first-month-off":
      return [
        hi,
        "Thanks for following.",
        `If you've been thinking about subscribing, your first month is ${off} until ${until}.`,
      ].join(" ");
    case "personal-invite":
      return [
        hi,
        "Thanks for following, it means a lot.",
        "If you've ever thought about subscribing, I'd love to have you. You can do it from my page any time.",
      ].join(" ");
    case "friendly-reminder":
      return [
        hi,
        "Quick one: auto-renew is off on your subscription, so it ends when this billing period does.",
        "If you want to stay, you can switch it back on in your subscription settings.",
        "If you meant to turn it off, that's fine, and thanks for being here.",
      ].join(" ");
    case "whats-coming":
      return [
        hi,
        "Quick heads up: auto-renew is off on your subscription, so it ends when this billing period does.",
        "Next month I've got [say what's coming next month], and I'd love you to be here for it.",
        "You can switch auto-renew back on in your subscription settings.",
      ].join(" ");
    case "welcome":
      return [
        `Welcome in, it's ${input.creatorName}, and I'm really glad you're here.`,
        "[Say what a new subscriber should look at first.]",
        "Message me any time.",
      ].join(" ");
  }
}

const PURPOSE: Record<DraftKind, string> = {
  welcome:
    "Write the short welcome message a new subscriber gets automatically the moment they subscribe. Include exactly one placeholder in square brackets, like [what to look at first], for the creator to fill in. Do not invent what is on the page.",
  "comeback-discount":
    "Write a message inviting subscribers who cancelled to come back, with a discount on their next month. Mention the discount and the date it ends.",
  "free-week-back":
    "Write a message inviting subscribers who cancelled to come back with some days free, to see what they've missed. Mention the number of free days and the date the offer ends.",
  "just-ask":
    "Write a personal message inviting subscribers who cancelled to come back. There is no discount. Include exactly one placeholder in square brackets where the creator will add something new, like [what you've posted since they left]. Do not invent what is new.",
  "free-trial":
    "Write a message inviting followers who don't subscribe yet to start a free trial. Mention the number of free days and the date the offer closes.",
  "first-month-off":
    "Write a message inviting followers who don't subscribe yet to subscribe, with a discount on their first month. Mention the discount and the date the offer closes.",
  "personal-invite":
    "Write a short, personal message inviting followers who don't subscribe yet to subscribe. There is no offer.",
  "friendly-reminder":
    "Write a message to subscribers whose auto-renew is switched off. Say plainly that auto-renew is off and that they can turn it back on in their subscription settings. There is no discount.",
  "whats-coming":
    "Write a message to subscribers whose auto-renew is switched off, giving them a reason to stay for next month, and saying they can turn auto-renew back on in their subscription settings. Include exactly one placeholder in square brackets, like [what's coming next month], for the creator to fill in. Do not invent what is coming. There is no discount.",
};

export function systemPrompt(approach: DraftKind): string {
  return [
    `You write messages that a Fanvue creator sends to their fans. ${PURPOSE[approach]}`,
    "Rules:",
    "- Write as the creator, in their voice. When examples of their messages are given, match their tone, length and phrasing, but take no facts or offers from them.",
    "- Friendly and non-pushy. Never guilt-trip or use urgency tricks.",
    "- No explicit content: this is a message about an offer.",
    "- Invent nothing. Do not promise results, refunds, or anything not in the input.",
    `- Plain text only, no markdown, under ${MAX_DRAFT_CHARS} characters.`,
    "- Do not use the word 'unsubscribe'.",
  ].join("\n");
}

export function userPrompt(input: DraftInput): string {
  const { off, free, until } = offerWords(input);
  const lines = [`Creator: ${input.creatorName}`];
  if (input.bio) lines.push(`Their bio: ${input.bio}`);
  if (off || free) lines.push(`Offer: ${off || free}`, `Offer ends: ${until}`);
  if (input.topUnsubscribeReason) lines.push(`Top reason fans gave for leaving: ${input.topUnsubscribeReason}`);
  lines.push(`Sending to ${input.recipientCount} people.`);
  if (input.voiceSamples.length > 0) {
    lines.push("", "Messages this creator wrote before, for voice only:");
    lines.push(...input.voiceSamples.map((sample) => `---\n${sample}`));
  }
  return lines.join("\n");
}
