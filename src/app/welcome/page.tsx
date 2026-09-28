import { redirect } from "next/navigation";
import { budgetFor } from "@/actions/draft-budget";
import { draftWelcome } from "@/actions/draft-message";
import { dayOneReport, isDayOne } from "@/audit/rules/day-one";
import { subscriptionPrice } from "@/audit/rules/helpers";
import { Onboarding } from "@/components/Onboarding";
import { ErrorState } from "@/components/States";
import { getCreatorData } from "@/data/get-source";
import { attempt } from "@/server/attempt";

export const dynamic = "force-dynamic";

/** The welcome flow for an account with no fans yet. A step that's already done says so. */
export default async function WelcomePage() {
  const data = await getCreatorData();
  if (!data) redirect("/");
  const read = await attempt(() => data.getSnapshot());
  if ("error" in read) {
    const { message, recovery } = read.error;
    return <ErrorState title="We couldn't load your setup" message={message} recovery={recovery} />;
  }
  const snapshot = read.data;
  if (!isDayOne(snapshot)) redirect("/audit");

  const setup = dayOneReport(snapshot);
  const existing = setup.items.find((item) => item.id === "welcome")?.detail;
  const draft = existing
    ? { text: existing, source: "existing" as const }
    : await draftWelcome(snapshot, { budget: budgetFor(data.mode, snapshot.creator.uuid), reuse: true });

  return (
    <Onboarding
      creator={{ displayName: snapshot.creator.displayName, avatarUrl: snapshot.creator.avatarUrl }}
      setup={setup.items}
      currentPrice={subscriptionPrice(snapshot)}
      draft={{ text: draft.text, source: draft.source }}
    />
  );
}
