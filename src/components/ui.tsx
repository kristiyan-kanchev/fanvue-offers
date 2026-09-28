"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@fanvue/ui";

/** A screen's heading, with an optional icon beside it. */
export function Title({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {icon}
      <h1 className="typography-header-heading-sm text-balance text-content-primary sm:typography-header-heading-md">
        {children}
      </h1>
    </div>
  );
}

/** The paragraph under a heading. */
export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="max-w-prose text-pretty typography-body-default-16px-regular text-content-secondary">{children}</p>;
}

export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 pt-2">{children}</div>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return children ? <p className="typography-body-small-14px-regular text-error-content">{children}</p> : null;
}

/** A form's submit button. While pending, a spinner covers the label, so the button keeps its size. */
export function SubmitButton({ children, disabled, ...props }: Omit<ButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      <span className="grid place-items-center">
        <span className={`col-start-1 row-start-1 ${pending ? "invisible" : ""}`}>{children}</span>
        {pending ? <Spinner className="col-start-1 row-start-1" /> : null}
      </span>
    </Button>
  );
}

/** A small spinner in the text colour around it. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`} />;
}
