"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, CheckCircleIcon, Chip, LinkIcon, MessageIcon, ProgressBar, WalletIcon } from "@fanvue/ui";
import { PLACEHOLDER } from "@/actions/approaches";
import type { DayOneItem, SetupStep } from "@/audit/types";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { CopyLink } from "./CopyLink";
import { MessageComposer } from "./MessageComposer";
import { CreatorAvatar } from "./Profile";
import { Actions, ErrorText, Lead, Title } from "./ui";

const PRICES = [499, 799, 999, 1499, 1999];
const DEFAULT_PRICE = 999;
const TRIAL_DAYS = [3, 7, 14];
const DEFAULT_TRIAL_DAYS = 7;

const STEPS: SetupStep[] = ["price", "welcome", "trial-link"];
const ICON: Record<SetupStep, typeof WalletIcon> = { price: WalletIcon, welcome: MessageIcon, "trial-link": LinkIcon };

type Screen = "intro" | SetupStep | "done";

/** Three things a brand new page needs before its first fan, one per screen. Each can be skipped. */
export function Onboarding({
  creator,
  setup,
  currentPrice,
  draft,
}: {
  creator: { displayName: string; avatarUrl: string | null };
  setup: DayOneItem[];
  currentPrice: number | null;
  draft: { text: string; source: "llm" | "template" | "existing" };
}) {
  const router = useRouter();
  const done = Object.fromEntries(setup.map((item) => [item.id, item])) as Record<SetupStep, DayOneItem>;

  const [screen, setScreen] = useState<Screen>("intro");
  const [cents, setCents] = useState(currentPrice ?? DEFAULT_PRICE);
  const [welcome, setWelcome] = useState(draft.text);
  const [draftSource, setDraftSource] = useState(draft.source);
  const [days, setDays] = useState(DEFAULT_TRIAL_DAYS);
  const [link, setLink] = useState(done["trial-link"].url ?? null);
  const [finished, setFinished] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [redrafting, startRedrafting] = useTransition();

  const stepIndex = STEPS.indexOf(screen as SetupStep);
  const welcomeBlocked = PLACEHOLDER.test(welcome) || welcome.trim().length === 0;

  function next() {
    setError(null);
    setScreen(STEPS[stepIndex + 1] ?? "done");
  }

  function save(step: SetupStep, body: object, summary: string) {
    setError(null);
    startSaving(async () => {
      try {
        const result = await api<{ url?: string }>(`/api/setup/${step}`, body);
        setFinished((lines) => [...lines, summary]);
        if (step === "trial-link") setLink(result.url ?? null);
        else next();
      } catch (cause) {
        setError((cause as Error).message);
      }
    });
  }

  function redraft() {
    startRedrafting(async () => {
      try {
        const result = await api<{ text: string; source: "llm" | "template" }>("/api/setup/draft-welcome", {});
        setWelcome(result.text);
        setDraftSource(result.source);
      } catch (cause) {
        setError((cause as Error).message);
      }
    });
  }

  function finish() {
    startSaving(async () => {
      await api("/api/setup/finish", {}).catch(() => undefined);
      router.push("/audit");
      router.refresh();
    });
  }

  const skip = (
    <Button variant="tertiary" size="48" onClick={next}>
      Skip for now
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-onboarding flex-col gap-6 sm:gap-8 sm:py-4">
      {stepIndex >= 0 ? (
        <ProgressBar
          value={((stepIndex + 1) / STEPS.length) * 100}
          size="small"
          variant="brand"
          stepsLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
          ariaLabel="Setup progress"
        />
      ) : null}

      {screen === "intro" ? (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <CreatorAvatar name={creator.displayName} src={creator.avatarUrl} size={40} />
              <p className="typography-body-default-16px-regular text-content-secondary">
                Welcome, {creator.displayName.split(" ")[0]}.
              </p>
            </div>
            <Title>Let&rsquo;s get your page ready for your first fans.</Title>
            <Lead>Three quick things, about three minutes. Skip anything you&rsquo;d rather do later.</Lead>
          </div>
          <ul className="flex flex-col gap-3">
            {setup.map((item) => {
              const Icon = ICON[item.id];
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-muted">
                    <Icon aria-hidden className="size-5 text-brand-primary-default" />
                  </span>
                  <span className="typography-body-default-16px-regular text-content-primary">{item.label}</span>
                  {item.done ? (
                    <span className="ml-auto typography-description-12px-regular text-content-tertiary">Already done</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Actions>
            <Button variant="primary" size="48" onClick={() => setScreen("price")}>
              Let&rsquo;s go
            </Button>
            <Button variant="tertiary" size="48" loading={saving} onClick={finish}>
              Skip setup
            </Button>
          </Actions>
        </section>
      ) : null}

      {screen === "price" ? (
        <section className="flex flex-col gap-5">
          <Title>What should a month cost?</Title>
          <ChoiceChips
            label="Monthly price"
            options={[...new Set([...PRICES, cents])].toSorted((a, b) => a - b)}
            value={cents}
            format={formatPrice}
            onChange={setCents}
          />
          <Lead>
            {done.price.done
              ? `You're on ${done.price.detail}. You can keep it or change it.`
              : "You can change it any time. With no subscribers yet, changing it affects nobody."}
          </Lead>
          <Actions>
            {done.price.done && cents === currentPrice ? (
              <Button variant="primary" size="48" onClick={next}>
                Keep it
              </Button>
            ) : (
              <Button
                variant="primary"
                size="48"
                loading={saving}
                onClick={() => save("price", { cents }, `${formatPrice(cents)} a month`)}
              >
                {`Set ${formatPrice(cents)} a month`}
              </Button>
            )}
            {skip}
          </Actions>
          <ErrorText>{error}</ErrorText>
        </section>
      ) : null}

      {screen === "welcome" ? (
        <section className="flex flex-col gap-5">
          <Title>What should new subscribers hear first?</Title>
          <Lead>This goes to every new subscriber the moment they join, so nobody lands on a quiet page.</Lead>
          <MessageComposer
            creator={creator}
            to="To every new subscriber"
            value={welcome}
            onChange={setWelcome}
            writtenByAi={draftSource === "llm"}
            redrafting={redrafting}
            onRedraft={redraft}
          />
          {PLACEHOLDER.test(welcome) ? (
            <p role="status" className="typography-body-small-14px-semibold text-warning-content">
              Fill in the part in [brackets] first.
            </p>
          ) : null}
          <Actions>
            {done.welcome.done && welcome === draft.text ? (
              <Button variant="primary" size="48" onClick={next}>
                Keep it
              </Button>
            ) : (
              <Button
                variant="primary"
                size="48"
                loading={saving}
                disabled={welcomeBlocked}
                onClick={() => save("welcome", { text: welcome }, "Welcome message on")}
              >
                Turn it on
              </Button>
            )}
            {skip}
          </Actions>
          <ErrorText>{error}</ErrorText>
        </section>
      ) : null}

      {screen === "trial-link" ? (
        <section className="flex flex-col gap-5">
          <Title>Make a link people can try you with</Title>
          <Lead>
            Share it on Instagram, TikTok, X or anywhere else. Anyone who uses it gets your page free for a few
            days, then pays your price if they stay.
          </Lead>
          {link ? (
            <>
              <CopyLink url={link} />
              <Actions>
                <Button variant="primary" size="48" onClick={next}>
                  Continue
                </Button>
              </Actions>
            </>
          ) : (
            <>
              <ChoiceChips
                label="Free days"
                options={TRIAL_DAYS}
                value={days}
                format={(option) => `${option} days free`}
                onChange={setDays}
              />
              <Actions>
                <Button
                  variant="primary"
                  size="48"
                  loading={saving}
                  onClick={() => save("trial-link", { days }, `${days}-day trial link`)}
                >
                  Create my link
                </Button>
                {skip}
              </Actions>
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </section>
      ) : null}

      {screen === "done" ? (
        <section className="flex flex-col items-start gap-4 sm:gap-5">
          <Title icon={<CheckCircleIcon aria-hidden className="size-10 shrink-0 text-success-content" />}>
            {finished.length > 0 ? "You're ready for your first fans." : "No problem."}
          </Title>
          <Lead>
            {finished.length > 0
              ? "Share your link. Once people follow and subscribe, your dashboard shows where you're losing money and how to fix it."
              : "Your dashboard has everything you skipped, whenever you're ready."}
          </Lead>
          {finished.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {finished.map((line) => (
                <li key={line} className="flex items-center gap-2 typography-body-default-16px-regular text-content-primary">
                  <CheckCircleIcon aria-hidden className="size-5 text-success-content" />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="primary" size="48" loading={saving} onClick={finish}>
            Go to my dashboard
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function ChoiceChips({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  format: (option: number) => string;
  onChange: (option: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <Chip
          key={option}
          size="40"
          role="radio"
          aria-checked={value === option}
          selected={value === option}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </Chip>
      ))}
    </div>
  );
}
