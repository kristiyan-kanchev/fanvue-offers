"use client";

import { Chip } from "@fanvue/ui";
import { offerLabel, type Approach, type ApproachId } from "@/actions/approaches";
import { endOfDayAfter } from "@/actions/plan";
import { formatDate, formatPrice } from "@/lib/format";

export interface Choice {
  approach: ApproachId;
  value: number | undefined;
}

export function ApproachPicker({
  approaches,
  choice,
  recommended,
  recommendedWhy,
  subscriptionPrice,
  onChange,
}: {
  approaches: Approach[];
  choice: Choice;
  recommended: ApproachId;
  recommendedWhy: string | null;
  subscriptionPrice: number | null;
  onChange: (choice: Choice) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">How to fix it</legend>
      {approaches.map((approach) => {
        const selected = choice.approach === approach.id;
        const isRecommended = approach.id === recommended;
        return (
          <label
            key={approach.id}
            className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border-primary p-4 has-checked:border-content-primary has-checked:bg-surface-primary has-focus-visible:shadow-focus-ring sm:p-5"
          >
            <span className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="approach"
                checked={selected}
                onChange={() => onChange({ approach: approach.id, value: approach.offer?.default })}
                className="size-4 shrink-0 accent-content-primary"
              />
              <span className="typography-body-default-16px-semibold text-content-primary">{approach.label}</span>
              {isRecommended ? (
                <span className="rounded-full bg-success-surface px-2 py-0.5 typography-description-12px-semibold text-success-content">
                  Recommended
                </span>
              ) : null}
            </span>
            <span className="typography-body-small-14px-regular text-content-secondary">{approach.pitch}</span>
            <span className="typography-description-12px-regular text-content-tertiary">
              {(isRecommended && recommendedWhy) || approach.bestWhen}
            </span>

            {selected && approach.offer && choice.value !== undefined ? (
              <span className="flex flex-col gap-3 pt-2">
                <span className="flex flex-wrap gap-2" role="radiogroup" aria-label="How much">
                  {approach.offer.choices.map((option) => (
                    <Chip
                      key={option}
                      size="40"
                      role="radio"
                      aria-checked={choice.value === option}
                      selected={choice.value === option}
                      onClick={(event) => {
                        event.preventDefault();
                        onChange({ approach: approach.id, value: option });
                      }}
                    >
                      {offerLabel(approach.offer!.type, option)}
                    </Chip>
                  ))}
                </span>
                <span className="typography-body-small-14px-regular text-content-secondary">
                  {offerExplainer(approach, choice.value, subscriptionPrice)}
                </span>
              </span>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}

function offerExplainer(approach: Approach, value: number, cents: number | null): string {
  const until = formatDate(endOfDayAfter(new Date(), approach.offer!.openDays));
  if (approach.offer!.type === "discount") {
    const month = approach.kind === "winback" ? "their next month" : "their first month";
    const pay = cents
      ? ` They'd pay ${formatPrice(Math.round(cents * (1 - value / 100)))} for that month instead of ${formatPrice(cents)}.`
      : "";
    return `${value}% off ${month}.${pay} Open until ${until}.`;
  }
  const then = cents ? `, then ${formatPrice(cents)} a month if they stay` : "";
  return `${value} days free${then}. Open until ${until}.`;
}
