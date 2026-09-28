import { HourglassIcon, RepeatIcon, UserAddIcon } from "@fanvue/ui";
import type { ActionKind } from "@/audit/types";

const MARK: Record<ActionKind, { Icon: typeof RepeatIcon; className: string }> = {
  winback: { Icon: RepeatIcon, className: "bg-brand-secondary-muted text-brand-secondary-default" },
  "front-door": { Icon: UserAddIcon, className: "bg-brand-primary-muted text-brand-primary-default" },
  renewal: { Icon: HourglassIcon, className: "bg-brand-secondary-muted text-brand-secondary-default" },
};

/** Each problem's icon, so the three read differently at a glance. */
export function ProblemMark({ kind }: { kind: ActionKind }) {
  const { Icon, className } = MARK[kind];
  return (
    <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${className}`}>
      <Icon className="size-5" />
    </span>
  );
}
