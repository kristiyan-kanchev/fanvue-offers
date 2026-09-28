import { executeAction } from "@/actions/execute";
import { liveOfferFor } from "@/actions/guards";
import { describeRequests } from "@/actions/plan";
import { planFromEdits } from "@/actions/registry";
import { sendRefusal } from "@/actions/send-checks";
import { claimSend } from "@/actions/send-lock";
import { isActionKind } from "@/audit/types";
import { requireCreatorData } from "@/data/get-source";
import { snapshotCache } from "@/data/live-source";
import { FanvueApiError } from "@/fanvue/client";
import { getServerClient } from "@/fanvue/server-client";
import { entryFromSend, saveEntry } from "@/history/log";
import { recordDemoSend } from "@/lib/session";
import { getStore } from "@/lib/store";
import { apiError, errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Sends a fix: the offer, if it has one, then the message. `messageOnly` resends
 * just the message when the offer went out but the message didn't. In the demo
 * it's a dry run, remembered in the session.
 */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isActionKind(kind)) return apiError("not_found", "There is no fix of that kind.", 404);

  try {
    const body = await request.json().catch(() => null);
    const messageOnly = body?.messageOnly === true;

    // Fresh, not cached: this decides whether real people get a message.
    const data = await requireCreatorData({ force: true });
    const snapshot = await data.getSnapshot();
    const plan = planFromEdits(kind, snapshot, body);
    if (!plan) return apiError("bad_request", "The request was incomplete or out of range.", 400, "Start the fix again.");

    const now = new Date();
    const refusal = sendRefusal(kind, snapshot, plan, { messageOnly, now });
    if (refusal) return apiError(refusal.code, refusal.message, refusal.status, refusal.recovery);

    if (data.mode === "demo") {
      await recordDemoSend(plan, now);
      return json({ dryRun: true, plan, requests: describeRequests(plan) });
    }

    const client = await getServerClient();
    if (!client) throw new FanvueApiError({ status: 401, message: "Your Fanvue session has expired." });

    // Two tabs pressing Send together both pass the weekly check. Only one goes on.
    const store = getStore();
    const lock = await claimSend(store, snapshot.creator.uuid, kind);
    if (!lock.held) {
      return apiError("already_sending", "This fix is already being sent from another tab or device.", 409);
    }

    const result = await executeAction(plan, client, { messageOnly });
    snapshotCache.invalidate(snapshot.creator.uuid);
    if (!result.ok) {
      await lock.release();
      return json({ dryRun: false, plan, result }, 502);
    }

    await saveEntry(
      store,
      snapshot.creator.uuid,
      entryFromSend(
        plan,
        {
          massMessageUuid: result.massMessageUuid,
          // A message-only resend reuses the offer made the first time.
          promotionUuid: result.promotionUuid ?? (messageOnly ? (liveOfferFor(snapshot, kind, now)?.uuid ?? null) : null),
          recipientCount: result.recipientCount,
          automated: result.automated?.ok === true,
        },
        snapshot.creator.subscriptionPrice,
        now,
      ),
    );
    return json({ dryRun: false, plan, result });
  } catch (cause) {
    return errorResponse(cause);
  }
}
