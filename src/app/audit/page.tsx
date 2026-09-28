import { redirect } from "next/navigation";
import { Overview } from "@/components/Overview";
import { ErrorState } from "@/components/States";
import { getSession } from "@/lib/session";
import { attempt } from "@/server/attempt";
import { loadAuditPayload } from "@/server/load-audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const result = await attempt(() => loadAuditPayload());
  if ("error" in result) {
    const { message, recovery } = result.error;
    return <ErrorState title="We couldn't load your numbers" message={message} recovery={recovery} />;
  }

  // An account with no fans sees the welcome flow once, before its dashboard.
  if (result.data.report.dayOne && !session.onboarded) redirect("/welcome");
  return <Overview data={result.data} />;
}
