import { Skeleton } from "@fanvue/ui";
import { checkAgain } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "./ui";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" width="30%" height={28} />
        <Skeleton variant="text" width="55%" height={16} />
      </div>
      <Skeleton variant="rectangular" width="100%" height={190} />
    </div>
  );
}

/** What went wrong, and a way on: by default, reading Fanvue again. */
export function ErrorState({
  title,
  message,
  recovery,
  action = <CheckAgain label="Try again" variant="secondary" />,
}: {
  title: string;
  message: string;
  recovery?: string;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-border-error px-6 py-5">
      <div className="flex flex-col gap-1">
        <h2 className="typography-body-default-16px-semibold text-content-primary">{title}</h2>
        <p className="typography-body-small-14px-regular text-content-secondary">{message}</p>
        {recovery ? <p className="typography-body-small-14px-regular text-content-tertiary">{recovery}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** When the numbers were read, and a button to read them again. */
export function Freshness({ fetchedAt }: { fetchedAt: string }) {
  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-border-primary pt-4">
      <span className="typography-description-12px-regular text-content-tertiary">
        From Fanvue, checked {formatDateTime(fetchedAt)}.
      </span>
      <CheckAgain label="Check again" variant="tertiary" />
    </footer>
  );
}

function CheckAgain({ label, variant }: { label: string; variant: "secondary" | "tertiary" }) {
  return (
    <form action={checkAgain}>
      <SubmitButton variant={variant} size="32">
        {label}
      </SubmitButton>
    </form>
  );
}
