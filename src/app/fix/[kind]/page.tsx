import { notFound, redirect } from "next/navigation";
import { budgetFor } from "@/actions/draft-budget";
import { preparePlan } from "@/actions/registry";
import { audit } from "@/audit/audit";
import { topUnsubscribeReason } from "@/audit/rules/downsell";
import { subscriptionPrice } from "@/audit/rules/helpers";
import { automaticReminderOn, tellStory } from "@/audit/story";
import { isActionKind } from "@/audit/types";
import { FixFlow } from "@/components/fix-flow/FixFlow";
import { ErrorState } from "@/components/States";
import { getCreatorData } from "@/data/get-source";
import { formatPercent } from "@/lib/format";
import { attempt } from "@/server/attempt";

export const dynamic = "force-dynamic";

/** One fix, drafted before the page renders. */
export default async function FixPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isActionKind(kind)) notFound();

  const data = await getCreatorData();
  if (!data) redirect("/");
  const read = await attempt(() => data.getSnapshot());
  if ("error" in read) {
    const { message, recovery } = read.error;
    return <ErrorState title="We couldn't load this fix" message={message} recovery={recovery} />;
  }
  const snapshot = read.data;

  // A fix that's done or was just sent (a bookmarked link, say) goes back to the overview.
  const card = tellStory(audit(snapshot), snapshot).todo.find((c) => c.kind === kind);
  if (!card) redirect("/audit");

  const prepared = await preparePlan(kind, snapshot, {}, { budget: budgetFor(data.mode, snapshot.creator.uuid), reuse: true });
  if (!prepared) redirect("/audit");

  const reason = topUnsubscribeReason(snapshot);
  const recommendedWhy =
    kind === "winback" && reason?.reason === "too_expensive"
      ? `${formatPercent(reason.share)} of fans who left said price was the reason.`
      : null;

  return (
    <FixFlow
      card={card}
      creator={{ displayName: snapshot.creator.displayName, avatarUrl: snapshot.creator.avatarUrl }}
      initialPlan={prepared.plan}
      recommended={prepared.plan.approach}
      recommendedWhy={recommendedWhy}
      automaticReminderOn={automaticReminderOn(snapshot)}
      draftSource={prepared.draft.source}
      draftWarning={prepared.draft.warning ?? null}
      subscriptionPrice={subscriptionPrice(snapshot)}
    />
  );
}
