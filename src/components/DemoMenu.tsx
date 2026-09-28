"use client";

import { useTransition } from "react";
import {
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fanvue/ui";
import { startDemo } from "@/app/actions";
import { DEMO_PERSONAS, type DemoPersona } from "@/data/types";
import { Spinner } from "./ui";

const PERSONA: Record<DemoPersona, { label: string; helper: string }> = {
  maya: { label: "Established account", helper: "1,250 subscribers" },
  "day-one": { label: "Brand new account", helper: "No fans yet" },
};

/** The demo chip: which sample account is showing, and the way to a real one. */
export function DemoMenu({ current }: { current: DemoPersona }) {
  const [switching, startSwitching] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={switching}
        className="flex h-8 items-center gap-1.5 rounded-full bg-brand-primary-muted pr-2 pl-3 typography-body-small-14px-semibold text-content-primary transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-default disabled:opacity-70"
      >
        Demo
        {switching ? <Spinner /> : <ChevronDownIcon aria-hidden className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuRadioGroup
          className="flex flex-col gap-1"
          value={current}
          onValueChange={(persona) => startSwitching(() => startDemo(persona as DemoPersona))}
        >
          {DEMO_PERSONAS.map((persona) => (
            <DropdownMenuRadioItem key={persona} value={persona} helper={PERSONA[persona].helper}>
              {PERSONA[persona].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/api/oauth/login">Connect your Fanvue</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
