"use client";

import { useState } from "react";
import { Button, CopyIcon } from "@fanvue/ui";

/** A link shown in full, with one button to copy it. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-secondary py-2 pl-4 pr-2">
      <span className="min-w-0 flex-1 truncate typography-body-small-14px-regular text-content-primary">{url}</span>
      <Button
        variant="secondary"
        size="32"
        leftIcon={<CopyIcon aria-hidden className="size-4" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
