
import Link from "next/link";
import { CheckCircleIcon, CheckOutlineIcon } from "@fanvue/ui";
import type { DayOneReport } from "@/audit/types";
import { CopyLink } from "./CopyLink";

/**
 * An account with no fans yet: what is set up, what isn't, and the trial link
 * to share, since sharing it is the next thing that makes money.
 */
export function DayOneChecklist({ report }: { report: DayOneReport }) {
  const link = report.items.find((item) => item.id === "trial-link")?.url;
  return (
    <section className="flex flex-col gap-6">
      {link ? (
        <div className="flex flex-col gap-2">
          <h2 className="typography-body-default-16px-semibold text-content-primary">Your free trial link</h2>
          <CopyLink url={link} />
          <p className="typography-description-12px-regular text-content-tertiary">
            Put it in your bio and share it in posts. It&rsquo;s the quickest way to your first fans.
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {report.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border-primary px-4 py-3">
            {item.done ? (
              <CheckCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-success-content" />
            ) : (
              <CheckOutlineIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-content-tertiary" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="typography-body-small-14px-semibold text-content-primary">{item.label}</span>
              <span className="typography-description-12px-regular text-content-secondary line-clamp-2">
                {item.done && item.detail && item.id !== "trial-link" ? item.detail : item.why}
              </span>
            </div>
            <span className="sr-only">{item.done ? "Done" : "Not done"}</span>
          </li>
        ))}
      </ul>

      <Link href="/welcome" className="typography-body-small-14px-regular text-content-secondary">
        {report.completedCount === report.items.length ? "Change your setup" : "Finish setting up"} &rarr;
      </Link>
    </section>
  );
}
