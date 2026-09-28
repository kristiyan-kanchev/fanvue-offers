import Link from "next/link";
import { leave } from "@/app/actions";
import type { DemoPersona } from "@/data/types";
import type { Theme } from "@/lib/theme";
import { BrandMark } from "./BrandMark";
import { DemoMenu } from "./DemoMenu";
import { ThemeToggle } from "./ThemeToggle";
import { SubmitButton } from "./ui";

/** The header, once connected or in the demo. The landing page has none. */
export function AppShell({
  mode,
  demoPersona,
  theme,
  children,
}: {
  mode: "live" | "demo" | null;
  demoPersona: DemoPersona | null;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {mode ? (
        <header className="sticky top-0 z-30 border-b border-border-primary/60 bg-background-primary/60 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-page items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
            <Link href="/audit" aria-label="Offers, home" className="brand-link flex shrink-0 items-center rounded-lg">
              <BrandMark size={32} />
              <span className="wordmark">
                <span className="typography-body-default-16px-semibold tracking-tight text-content-primary">Offers</span>
              </span>
            </Link>
            {mode === "demo" ? <DemoMenu current={demoPersona ?? "maya"} /> : null}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ThemeToggle theme={theme} />
              <form action={leave}>
                <SubmitButton variant="tertiary" size="32">
                  {mode === "demo" ? "Exit demo" : "Disconnect"}
                </SubmitButton>
              </form>
            </div>
          </div>
        </header>
      ) : null}

      <main
        className={`mx-auto w-full max-w-page grow px-4 pb-[max(--spacing(6),env(safe-area-inset-bottom))] sm:px-6 sm:pb-8 ${
          mode ? "pt-6 sm:pt-8" : "pt-[max(--spacing(6),env(safe-area-inset-top))] sm:pt-8"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
