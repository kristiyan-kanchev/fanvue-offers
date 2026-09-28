import { PLACEHOLDER } from "./approaches";
import type { Offer } from "./plan";

/*
 * What a message says about money off and free time, read loosely enough to
 * catch how people (and models) write it: "40% off", "40 percent", "half
 * price", "7 days free", "a 7-day trial", "a free week", "two weeks free".
 */
const PERCENT = /(\d{1,3})\s?(?:%|percent\b)/gi;
const HALF = /\bhalf[\s-]?(?:price|off)\b/i;
const DAYS = /(\d{1,2})[\s-]?(?:free[\s-])?days?\b/gi;
const WEEKS = /\b(a|one|1|two|2|three|3|four|4)[\s-]?(?:free[\s-])?weeks?\b/gi;
const FREE_TRIAL = /\bfree[\s-]trial\b/i;
const DISCOUNT = /\bdiscount/i;

const WEEK_WORDS: Record<string, number> = { a: 1, one: 1, "1": 1, two: 2, "2": 2, three: 3, "3": 3, four: 4, "4": 4 };

function percentsSaid(text: string): number[] {
  const numbers = [...text.matchAll(PERCENT)].map((m) => Number(m[1]));
  return HALF.test(text) ? [...numbers, 50] : numbers;
}

/** Whether the words around a match (or the match itself) call the time free. */
function isFree(text: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  const around = text.slice(Math.max(0, start - 15), start + match[0].length + 15);
  return /\bfree\b|\btrial\b/i.test(around);
}

/** Days mentioned. With `freeOnly`, only days described as free: "in 3 days" is just time. */
function daysSaid(text: string, freeOnly: boolean): number[] {
  const days = [...text.matchAll(DAYS)]
    .filter((m) => !freeOnly || isFree(text, m))
    .map((m) => Number(m[1]));
  // A week only counts when it's free: "a week ago" isn't an offer.
  const weeks = [...text.matchAll(WEEKS)]
    .filter((m) => isFree(text, m))
    .map((m) => WEEK_WORDS[m[1]!.toLowerCase()]! * 7);
  return [...days, ...weeks];
}

/**
 * Why this message must not go out as written, or null. A message that promises
 * something the offer doesn't give would mislead fans, and a [placeholder] is
 * something only the creator can fill in. Run in the browser to explain, and
 * again on the server before anything is sent.
 */
export function messageProblem(offer: Offer | null, text: string): string | null {
  if (text.trim().length === 0) return "Write a message first.";
  if (PLACEHOLDER.test(text)) return "Fill in the part in [brackets] first.";

  const percents = percentsSaid(text);
  const freeDays = daysSaid(text, true);
  const mentionsFreeTime = freeDays.length > 0 || FREE_TRIAL.test(text);

  if (!offer) {
    if (percents.length > 0 || DISCOUNT.test(text)) {
      return "The message mentions money off, but this fix has no offer.";
    }
    if (mentionsFreeTime) return "The message mentions free time, but this fix has no offer.";
    return null;
  }

  if (offer.type === "discount") {
    const wrong = percents.find((n) => n !== offer.percent);
    if (wrong !== undefined) {
      return `The message says ${wrong}% off, but your offer is ${offer.percent}% off.`;
    }
    if (mentionsFreeTime) return `The message mentions free time, but your offer is ${offer.percent}% off.`;
    return null;
  }

  if (percents.length > 0 || DISCOUNT.test(text)) {
    return `The message mentions money off, but your offer is ${offer.days} days free.`;
  }
  // Any number of days in a trial message is read as its length.
  const wrong = daysSaid(text, false).find((n) => n !== offer.days);
  if (wrong !== undefined) {
    return `The message says ${wrong} days, but your offer is ${offer.days} days free.`;
  }
  return null;
}
