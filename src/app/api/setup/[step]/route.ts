import { budgetFor } from "@/actions/draft-budget";
import { draftWelcome } from "@/actions/draft-message";
import { demoSetupFor, runSetupStep, SETUP_REQUEST } from "@/actions/setup";
import { isDayOne } from "@/audit/rules/day-one";
import { demoTrialLinkUrl } from "@/data/fixture-source";
import { requireCreatorData } from "@/data/get-source";
import { snapshotCache } from "@/data/live-source";
import { FanvueApiError } from "@/fanvue/client";
import { getServerClient } from "@/fanvue/server-client";
import { markOnboarded, recordDemoSetup } from "@/lib/session";
import { apiError, errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * The welcome flow: POST /api/setup/{price|welcome|trial-link} makes one Fanvue
 * call, draft-welcome writes a new welcome message, finish ends the flow.
 */
export async function POST(request: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;

  try {
    const data = await requireCreatorData();

    if (step === "finish") {
      await markOnboarded();
      return json({ ok: true });
    }

    const snapshot = await data.getSnapshot();

    if (step === "draft-welcome") {
      const draft = await draftWelcome(snapshot, { budget: budgetFor(data.mode, snapshot.creator.uuid) });
      return json({ text: draft.text, source: draft.source, warning: draft.warning ?? null });
    }

    const parsed = SETUP_REQUEST.safeParse({ ...(await request.json().catch(() => ({}))), step });
    if (!parsed.success) return apiError("bad_request", parsed.error.issues[0]?.message ?? "That isn't valid.", 400);

    // Only for an account with no fans yet: changing an established account's price is another decision.
    if (!isDayOne(snapshot)) {
      return apiError("already_completed", "Setup is only for a brand new account.", 409, "Go to your overview.");
    }

    if (data.mode === "demo") {
      await recordDemoSetup(demoSetupFor(parsed.data));
      const url = parsed.data.step === "trial-link" ? demoTrialLinkUrl(snapshot.creator.handle) : undefined;
      return json({ ok: true, url });
    }

    const client = await getServerClient();
    if (!client) throw new FanvueApiError({ status: 401, message: "Your Fanvue session has expired." });
    const result = await runSetupStep(client, parsed.data);
    snapshotCache.invalidate(snapshot.creator.uuid);
    return json({ ok: true, ...result });
  } catch (cause) {
    return errorResponse(cause);
  }
}
