// Fanvue quotes every price and earnings figure in USD cents; nothing is converted.
export const LOCALE = "en-GB";

const wholeDollars = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const dollarsAndCents = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const count = new Intl.NumberFormat(LOCALE);
const date = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** 177800 → "US$1,778" */
export const formatMoney = (cents: number) => wholeDollars.format(cents / 100);

/** 999 → "US$9.99" */
export const formatPrice = (cents: number) => dollarsAndCents.format(cents / 100);

export const formatCount = (value: number) => count.format(value);

/** 1 → "1 fan", 178 → "178 fans" */
export const formatPeople = (value: number, one: string, many: string) => `${formatCount(value)} ${value === 1 ? one : many}`;

/** 0.41 → "41%" */
export const formatPercent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** In UTC, since offers close at the end of a UTC day. */
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

const REASON_LABELS: Record<string, string> = {
  too_expensive: "price",
  not_enough_content: "not enough content",
  content_not_expected: "content was not what they expected",
  creator_not_active: "the creator went quiet",
  other: "another reason",
};

export function unsubscribeReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}
