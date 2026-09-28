"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { Button, CheckCircleIcon } from "@fanvue/ui";
import { offerLabel } from "@/actions/approaches";
import { offerValue, type ActionPlan } from "@/actions/plan";
import { formatCount, formatDate, LOCALE } from "@/lib/format";
import { Actions, Lead, Title } from "../ui";
import type { SendResult } from "./send";

export function FixResult({
  result,
  plan,
  audience,
  resending,
  onResend,
  onBack,
  onFinish,
}: {
  result: SendResult;
  plan: ActionPlan;
  audience: string;
  resending: boolean;
  onResend: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  switch (result.kind) {
    case "sent": {
      const follow = plan.offer
        ? `Your ${offerLabel(plan.offer.type, offerValue(plan.offer)!)} offer is open until ${formatDate(plan.endsAt!)}. Come back in a few days to see how many took it up.`
        : "Come back in a few days to see how it went.";
      const reminder = {
        on: " Your automatic reminder is on too.",
        failed: " The automatic reminder didn't switch on, so try again from the overview later.",
      };
      return (
        <Screen
          title={
            <>
              Sent. <CountUp to={result.recipients} /> {audience} have your message.
            </>
          }
          icon={<CheckCircleIcon aria-hidden className="size-10 shrink-0 text-success-content" />}
          lead={`${follow}${result.automated ? reminder[result.automated] : ""}`}
        >
          <Button variant="primary" size="48" onClick={onFinish}>
            Back to overview
          </Button>
        </Screen>
      );
    }
    case "offer-live-message-failed":
      return (
        <Screen
          title="Your offer is live, but the message didn't send"
          lead={`Fanvue had a problem sending it (${result.error}). Sending again is safe: nobody gets it twice, and no second offer is made.`}
        >
          <Button variant="primary" size="48" loading={resending} onClick={onResend}>
            Try sending again
          </Button>
        </Screen>
      );
    case "unknown":
      return (
        <Screen
          title="We couldn't tell if it went out"
          lead="The connection dropped before Fanvue answered, so it may have been sent. Check your overview before trying again: if it went out, it shows there as done."
        >
          <Button variant="primary" size="48" onClick={onFinish}>
            Check my overview
          </Button>
        </Screen>
      );
    case "failed":
      return (
        <Screen title="That didn't go through" lead={`Nothing was sent. ${result.error}`}>
          <Button variant="primary" size="48" onClick={onBack}>
            Go back and try again
          </Button>
        </Screen>
      );
  }
}

function Screen({
  title,
  icon,
  lead,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-4 sm:gap-5 sm:py-4">
      <Title icon={icon}>{title}</Title>
      <Lead>{lead}</Lead>
      <Actions>{children}</Actions>
    </section>
  );
}

/**
 * Rolls up from zero once. A timer, not an animation frame, which a background tab would pause at zero.
 * The digits live in a shadow root screen readers skip, so the number is also there as text.
 */
function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setValue(to), 60);
    return () => clearTimeout(timer);
  }, [to]);
  return (
    <>
      <NumberFlow value={value} locales={LOCALE} aria-hidden />
      <span className="sr-only">{formatCount(to)}</span>
    </>
  );
}
