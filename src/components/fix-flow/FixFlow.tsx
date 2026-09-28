"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Checkbox, Stepper } from "@fanvue/ui";
import { APPROACHES, type ApproachId } from "@/actions/approaches";
import { messageProblem } from "@/actions/message-check";
import { AUDIENCE_NOUN, describeRequests, offerValue, type ActionPlan } from "@/actions/plan";
import type { FixCard } from "@/audit/story";
import { api } from "@/lib/api";
import { formatPeople } from "@/lib/format";
import { MessageComposer } from "../MessageComposer";
import { ProblemMark } from "../ProblemMark";
import { Actions, ErrorText, Lead, Title } from "../ui";
import { ApproachPicker, type Choice } from "./ApproachPicker";
import { FixResult } from "./FixResult";
import { sendFix, type SendResult } from "./send";

const STEPS = [{ title: "The problem" }, { title: "Your approach" }, { title: "Your message" }];

interface Drafted {
  plan: ActionPlan;
  draft: { text: string; source: "llm" | "template"; warning: string | null };
}

/** A fix one step at a time: the problem, how to fix it, the message, then send. */
export function FixFlow({
  card,
  creator,
  initialPlan,
  recommended,
  recommendedWhy,
  automaticReminderOn,
  draftSource: initialSource,
  draftWarning,
  subscriptionPrice,
}: {
  card: FixCard;
  creator: { displayName: string; avatarUrl: string | null };
  initialPlan: ActionPlan;
  recommended: ApproachId;
  recommendedWhy: string | null;
  /** Fanvue already sends an automatic message when someone turns off auto-renew. */
  automaticReminderOn: boolean;
  draftSource: "llm" | "template";
  draftWarning: string | null;
  subscriptionPrice: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(initialPlan);
  const [choice, setChoice] = useState<Choice>({ approach: initialPlan.approach, value: offerValue(initialPlan.offer) });
  const [messageText, setMessageText] = useState(initialPlan.messageText);
  const [draftSource, setDraftSource] = useState(initialSource);
  const [notice, setNotice] = useState(draftWarning);
  const [result, setResult] = useState<SendResult | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [sending, startSending] = useTransition();

  // A reminder that doesn't date makes a good automatic message; one about next month doesn't.
  const automateByDefault = (approach: ApproachId) => approach === "friendly-reminder" && !automaticReminderOn;
  const [automate, setAutomate] = useState(automateByDefault(initialPlan.approach));

  const planToSend: ActionPlan = { ...plan, messageText, automate: plan.kind === "renewal" && automate };
  const [one, many] = AUDIENCE_NOUN[plan.kind];
  const people = formatPeople(plan.recipientEstimate, one, many);
  const blocked = messageProblem(plan.offer, messageText);

  function draft(next: Choice, then?: () => void) {
    setNotice(null);
    startDrafting(async () => {
      try {
        const { plan: drafted, draft } = await api<Drafted>(`/api/actions/${plan.kind}/plan`, {
          idempotencyKey: plan.idempotencyKey,
          approach: next.approach,
          value: next.value,
        });
        setPlan(drafted);
        setMessageText(drafted.messageText);
        setDraftSource(draft.source);
        setNotice(draft.warning);
        then?.();
      } catch (cause) {
        setNotice((cause as Error).message);
      }
    });
  }

  function toMessage() {
    const changed = choice.approach !== plan.approach || choice.value !== offerValue(plan.offer);
    if (!changed) return setStep(2);
    draft(choice, () => {
      setAutomate(automateByDefault(choice.approach));
      setStep(2);
    });
  }

  function send(options?: { messageOnly: boolean }) {
    startSending(async () => setResult(await sendFix(planToSend, options)));
  }

  if (result) {
    return (
      <FixResult
        result={result}
        plan={planToSend}
        audience={plan.recipientEstimate === 1 ? one : many}
        resending={sending}
        onResend={() => send({ messageOnly: true })}
        onBack={() => setResult(null)}
        onFinish={() => {
          router.push("/audit");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Link href="/audit" className="typography-body-small-14px-regular text-content-secondary">
        &larr; Back to overview
      </Link>

      <Stepper activeStep={step} steps={STEPS} size="sm" />

      {step === 0 ? (
        <section className="flex flex-col gap-4">
          <Title icon={<ProblemMark kind={plan.kind} />}>{card.title}</Title>
          <Lead>{card.why}</Lead>
          {card.worth ? <p className="typography-body-default-16px-semibold text-content-primary">{card.worth}</p> : null}
          {card.plan ? (
            <p className="max-w-prose typography-body-small-14px-regular text-content-secondary">
              <span className="typography-body-small-14px-semibold text-content-primary">Ways to fix it: </span>
              {card.plan}
            </p>
          ) : null}
          <Actions>
            <Button variant="primary" size="48" onClick={() => setStep(1)}>
              Choose how to fix it
            </Button>
          </Actions>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="flex flex-col gap-4 sm:gap-5">
          <Title>How do you want to fix it?</Title>
          <ApproachPicker
            approaches={APPROACHES[plan.kind]}
            choice={choice}
            recommended={recommended}
            recommendedWhy={recommendedWhy}
            subscriptionPrice={subscriptionPrice}
            onChange={setChoice}
          />
          <Actions>
            <Button variant="primary" size="48" loading={drafting} onClick={toMessage}>
              Write the message
            </Button>
            <Button variant="tertiary" size="48" onClick={() => setStep(0)}>
              Back
            </Button>
          </Actions>
          <ErrorText>{notice}</ErrorText>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-4 sm:gap-5">
          <Title>This is what {people} will get</Title>

          <MessageComposer
            creator={creator}
            to={`To ${people}`}
            value={messageText}
            onChange={setMessageText}
            writtenByAi={draftSource === "llm"}
            redrafting={drafting}
            onRedraft={() => draft({ approach: plan.approach, value: offerValue(plan.offer) })}
          />

          {plan.kind === "renewal" ? (
            <div className="rounded-lg border border-border-primary p-4">
              <Checkbox
                checked={automate}
                onCheckedChange={(checked) => setAutomate(checked === true)}
                label={
                  automaticReminderOn
                    ? "Also use this as your automatic reminder"
                    : "Also send this automatically to anyone who turns off auto-renew from now on"
                }
                helperText={
                  automaticReminderOn
                    ? "You already have one. This would replace it."
                    : plan.approach === "whats-coming"
                      ? "It mentions next month, so it may go out of date."
                      : "Set it once and every future reminder sends itself."
                }
              />
            </div>
          ) : null}

          {blocked ? (
            <p role="status" className="typography-body-small-14px-semibold text-warning-content">
              {blocked}
            </p>
          ) : null}
          {notice ? <p className="typography-body-small-14px-regular text-warning-content">{notice}</p> : null}

          <div className="border-t border-border-primary pt-5">
            <Actions>
              <Button
                variant="primary"
                size="48"
                loading={sending}
                disabled={Boolean(blocked) || drafting || sending}
                onClick={() => send()}
              >
                {`Send to ${people}`}
              </Button>
              <Button variant="tertiary" size="48" onClick={() => setStep(1)}>
                Back
              </Button>
            </Actions>
          </div>

          <details className="typography-description-12px-regular text-content-tertiary">
            <summary className="cursor-pointer">What gets sent to Fanvue</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-background-secondary p-3">
              {describeRequests(planToSend)
                .map((request) => `${request.method} ${request.path}\n${JSON.stringify(request.body, null, 2)}`)
                .join("\n\n")}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
