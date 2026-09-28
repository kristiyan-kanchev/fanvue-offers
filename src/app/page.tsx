import { redirect } from "next/navigation";
import { Button, Logo } from "@fanvue/ui";
import { GlowPanel, LandingBackdrop } from "@/components/LandingBackdrop";
import { LandingGlimpse } from "@/components/LandingGlimpse";
import { StartDemoButton } from "@/components/StartDemoButton";
import { ACCESS_SUMMARY, FANVUE_APP_STORE_URL } from "@/fanvue/constants";
import { getSession } from "@/lib/session";
import { getTheme } from "@/server/theme";

export const dynamic = "force-dynamic";

// Only our own words: anyone can link here with an error in the URL, and its text must never show.
const ERROR_COPY: Record<string, string> = {
  oauth_state_mismatch: "The sign-in attempt did not match this browser session. Start again.",
  oauth_token_exchange_failed: "Fanvue accepted the sign-in but the token exchange failed. Try connecting again.",
  access_denied: "You cancelled the Fanvue sign-in.",
};
const GENERIC_ERROR = "Connecting to Fanvue didn't work. Try again.";

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getSession()) redirect("/audit");

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? (ERROR_COPY[error] ?? GENERIC_ERROR) : null;

  return (
    <div className="flex max-w-landing flex-col gap-14 py-8 sm:py-12">
      <LandingBackdrop theme={await getTheme()} />

      <section className="flex flex-col gap-6">
        <h1 className="text-display-sm font-semibold tracking-tight text-content-primary sm:text-display">
          Stop leaving{" "}
          <span className="bg-linear-to-b from-transparent from-62% to-brand-primary-muted to-62% px-1">money</span> on
          Fanvue.
        </h1>
        <p className="typography-body-default-16px-regular text-content-secondary">
          Spot what&rsquo;s costing you. Fix it in two minutes.
        </p>

        {errorMessage ? (
          <p className="rounded-md border border-border-error bg-error-surface px-4 py-3 typography-body-small-14px-regular text-error-content">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button variant="primary" size="48" asChild>
            <a href="/api/oauth/login">
              <Logo variant="icon" size="20" aria-hidden />
              Connect with Fanvue
            </a>
          </Button>
          <StartDemoButton />
        </div>
      </section>

      <GlowPanel>
        <LandingGlimpse />
      </GlowPanel>

      <footer className="flex flex-col gap-2 border-t border-border-primary pt-5">
        <p className="typography-body-small-14px-regular text-content-secondary">
          Reads your stats, never your chats. Nothing sends without you.
        </p>
        <details className="typography-description-12px-regular text-content-tertiary">
          <summary className="cursor-pointer">What we access</summary>
          <ul className="flex flex-col gap-1 pt-2">
            {ACCESS_SUMMARY.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              Disconnect any time. Built to{" "}
              <a href={FANVUE_APP_STORE_URL} target="_blank" rel="noreferrer" className="underline">
                Fanvue App Store
              </a>{" "}
              rules.
            </li>
          </ul>
        </details>
      </footer>
    </div>
  );
}
