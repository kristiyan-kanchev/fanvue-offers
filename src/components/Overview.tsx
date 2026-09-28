import Link from "next/link";
import { Alert, Button } from "@fanvue/ui";
import { DAY_MS } from "@/actions/plan";
import type { CardState, FixCard, Story } from "@/audit/story";
import type { ActionKind } from "@/audit/types";
import type { HistoryRow } from "@/history/history";
import { formatDate, formatMoney } from "@/lib/format";
import type { History } from "@/server/load-history";
import type { AuditPayload } from "@/server/load-audit";
import { DayOneChecklist } from "./DayOneChecklist";
import { ProblemMark } from "./ProblemMark";
import { ProfileHeader } from "./Profile";
import { Freshness } from "./States";

const PLACES = ["no", "one", "two", "three"];
const RECENT_MS = 7 * DAY_MS;

type Tone = "good" | "plain";

/** One thing already under way: something sent from here, or set up on Fanvue. */
interface DoneItem {
  key: string;
  kind: ActionKind;
  title: string;
  badge: { label: string; tone: Tone };
  /** What it achieved, when there's something to count. */
  result?: { text: string; tone: Tone };
  note: string | null;
}

const ROW_BADGE: Record<HistoryRow["status"], DoneItem["badge"]> = {
  live: { label: "Live", tone: "good" },
  ended: { label: "Ended", tone: "plain" },
  sent: { label: "Sent", tone: "plain" },
};

const CARD_BADGE: Partial<Record<CardState, DoneItem["badge"]>> = {
  done: { label: "Live", tone: "good" },
  sent: { label: "Sent", tone: "plain" },
  auto: { label: "On", tone: "good" },
  waiting: { label: "Scheduled", tone: "plain" },
};

/**
 * What's under way, newest first. A fix sent from here shows as its row, with
 * its result, instead of again as the offer or message it made.
 */
function doneItems(story: Story, history: History, now: number): DoneItem[] {
  const rows = history.rows;
  const shownAsRow = (card: FixCard) =>
    rows.some(
      (row) =>
        row.kind === card.kind &&
        ((card.state === "done" && row.status === "live") ||
          (card.state === "sent" && now - Date.parse(row.sentAt) < RECENT_MS)),
    );

  const fromCards = story.inProgress
    .filter((card) => !shownAsRow(card))
    .map<DoneItem>((card) => ({
      key: `${card.kind}-${card.state}`,
      kind: card.kind,
      title: card.title,
      badge: CARD_BADGE[card.state] ?? ROW_BADGE.sent,
      note: card.status ?? null,
    }));

  const fromRows = rows.map<DoneItem>((row) => ({
    key: row.id,
    kind: row.kind,
    title: row.title,
    badge: ROW_BADGE[row.status],
    result: { text: row.result, tone: row.took ? "good" : "plain" },
    note: [formatDate(row.sentAt), row.note].filter(Boolean).join(" · "),
  }));

  return [...fromCards, ...fromRows];
}

/** What's costing the creator money, one row per thing to fix, and what's already under way. */
export function Overview({ data }: { data: AuditPayload }) {
  const { story, report, history } = data;
  const todo = story.todo.length;
  const done = doneItems(story, history, Date.parse(data.fetchedAt));

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <ProfileHeader creator={data.creator} />

      <header className="flex flex-col gap-3">
        <h1 className="typography-header-heading-sm text-balance text-content-primary sm:typography-header-heading-md">
          {report.dayOne
            ? report.dayOne.completedCount === report.dayOne.items.length
              ? "You're ready for your first fans."
              : "Your page is almost ready."
            : todo > 0
              ? `You're missing out on money in ${PLACES[todo] ?? todo} ${todo === 1 ? "place" : "places"}.`
              : "You're all caught up."}
        </h1>
        <p className="max-w-prose typography-body-default-16px-regular text-content-secondary">
          {report.dayOne
            ? "Once people follow and subscribe, this page shows where you're losing money and how to fix it."
            : todo > 0
              ? "About two minutes each. Nothing sends until you say so."
              : "Nothing needs fixing right now. Check back in a few days to see how your fixes are doing."}
        </p>
      </header>

      {data.incomplete ? (
        <Alert variant="warning" layout="under" title="Some of your numbers didn't load">
          <p className="typography-body-small-14px-regular">
            Fanvue didn&rsquo;t send us everything, so a few checks were skipped. Try again in a minute.
          </p>
        </Alert>
      ) : null}

      {report.dayOne ? (
        <DayOneChecklist report={report.dayOne} />
      ) : (
        <>
          {todo > 0 ? (
            <ol className="flex flex-col gap-3">
              {story.todo.map((card, index) => (
                <TodoRow key={card.kind} card={card} first={index === 0} />
              ))}
            </ol>
          ) : null}

          <HistorySection items={done} history={history} />

          <Section title="Looking fine">
            {[...story.fine, ...story.unknown].map((card) => (
              <li key={card.kind} className="typography-body-small-14px-regular text-content-secondary">
                {card.title}
              </li>
            ))}
          </Section>
        </>
      )}

      <Freshness fetchedAt={data.fetchedAt} />
    </div>
  );
}

function TodoRow({ card, first }: { card: FixCard; first: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border-primary bg-surface-primary p-4 sm:gap-4 sm:p-5">
      <ProblemMark kind={card.kind} />
      <h2 className="min-w-0 flex-1 typography-body-default-16px-semibold text-content-primary sm:typography-header-heading-xs">
        {card.title}
      </h2>
      <Button variant={first ? "primary" : "secondary"} size="40" className="shrink-0" asChild>
        <Link href={`/fix/${card.kind}`}>Fix this</Link>
      </Button>
    </li>
  );
}

const TONE: Record<Tone, string> = {
  good: "bg-success-surface text-success-content",
  plain: "bg-background-secondary text-content-secondary",
};

/** What's been sent and set up, folded away until it's asked for. */
function HistorySection({ items, history }: { items: DoneItem[]; history: History }) {
  const problem = history.unreadable
    ? "We couldn't load what you've sent just now. Press Check again in a minute."
    : history.recording
      ? null
      : "What you send isn't being saved right now, so new fixes won't show up here for a while.";
  if (items.length === 0 && !problem) return null;

  return (
    <section className="flex flex-col gap-3">
      <details className="group flex flex-col">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <h2 className="typography-description-12px-semibold uppercase tracking-wide text-content-tertiary">
              History
            </h2>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5 text-content-tertiary transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </span>
          {history.totals.earned > 0 ? (
            <span className="typography-body-small-14px-semibold text-success-content">
              {formatMoney(history.totals.earned)} brought in
            </span>
          ) : null}
        </summary>
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.key} className="flex gap-3 rounded-lg border border-border-primary bg-surface-primary p-4 sm:gap-4">
              <ProblemMark kind={item.kind} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="typography-body-default-16px-semibold text-content-primary">{item.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 typography-description-12px-semibold ${TONE[item.badge.tone]}`}>
                    {item.badge.label}
                  </span>
                </div>
                {item.result ? (
                  <p
                    className={`typography-body-small-14px-semibold ${item.result.tone === "good" ? "text-success-content" : "text-content-secondary"}`}
                  >
                    {item.result.text}
                  </p>
                ) : null}
                {item.note ? <p className="typography-body-small-14px-regular text-content-secondary">{item.note}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </details>
      {problem ? <p className="typography-body-small-14px-regular text-warning-content">{problem}</p> : null}
    </section>
  );
}

/** A labelled list, left out when it's empty. */
function Section({ title, children }: { title: string; children: React.ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="typography-description-12px-semibold uppercase tracking-wide text-content-tertiary">{title}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}
