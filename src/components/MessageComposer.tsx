"use client";

import { useLayoutEffect, useRef } from "react";
import { AiDisclosureBadge, IconButton, RefreshArrowIcon } from "@fanvue/ui";
import { CreatorAvatar } from "./Profile";

/**
 * A message as the fan will see it: from the creator, in a chat bubble that
 * is also the text box, so clicking it edits it. Drafts again from the icon.
 */
export function MessageComposer({
  creator,
  to,
  value,
  onChange,
  writtenByAi,
  redrafting,
  onRedraft,
}: {
  creator: { displayName: string; avatarUrl: string | null };
  to: string;
  value: string;
  onChange: (text: string) => void;
  writtenByAi: boolean;
  redrafting: boolean;
  onRedraft: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-background-secondary">
      <div className="flex items-center gap-3 border-b border-border-primary px-4 py-3">
        <CreatorAvatar name={creator.displayName} src={creator.avatarUrl} size={32} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate typography-body-small-14px-semibold text-content-primary">{creator.displayName}</span>
          <span className="typography-description-12px-regular text-content-tertiary">{to}</span>
        </div>
        <IconButton
          variant="tertiary"
          size="32"
          aria-label="Write another version"
          title="Write another version"
          disabled={redrafting}
          icon={<RefreshArrowIcon className={redrafting ? "size-5 animate-spin" : "size-5"} />}
          onClick={onRedraft}
        />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <MessageBox value={value} onChange={onChange} />
        {writtenByAi ? (
          <span className="flex items-center gap-1.5 typography-description-12px-regular text-content-tertiary">
            <AiDisclosureBadge tone="transparent" aria-hidden className="size-4" />
            Written by AI in your voice, from your recent messages
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The chat bubble at rest, a plain grey field while you type. Grows to fit its text. */
function MessageBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      box.style.height = "auto";
      box.style.height = `${box.scrollHeight}px`;
    };
    fit();
    // A narrower screen wraps the same text onto more lines.
    const observer = new ResizeObserver(fit);
    observer.observe(box.parentElement ?? box);
    return () => observer.disconnect();
  }, [value]);

  return (
    <textarea
      ref={ref}
      aria-label="Your message"
      value={value}
      rows={3}
      spellCheck
      onChange={(event) => onChange(event.target.value)}
      className="block w-full cursor-text resize-none overflow-hidden rounded-md border border-messages-background-sender-stroke bg-messages-background-sender px-3 py-2 typography-body-default-16px-regular text-content-primary outline-none transition-colors hover:border-neutral-alphas-400 focus:border-border-primary focus:bg-inputs-inputs-primary"
    />
  );
}
