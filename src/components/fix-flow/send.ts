import { executeBody, type ActionPlan } from "@/actions/plan";

export type SendResult =
  | { kind: "sent"; recipients: number; automated: "on" | "failed" | null }
  | { kind: "offer-live-message-failed"; error: string }
  | { kind: "failed"; error: string }
  /** No answer we could read: it may or may not have gone out. */
  | { kind: "unknown" };

/** Posts the fix and reads back what happened. A demo send reads as sent. */
export async function sendFix(plan: ActionPlan, { messageOnly = false } = {}): Promise<SendResult> {
  let body;
  try {
    const res = await fetch(`/api/actions/${plan.kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...executeBody(plan, plan.messageText), ...(messageOnly && { messageOnly: true }) }),
    });
    // A platform timeout answers with a page, not JSON: then nobody knows whether it went.
    body = await res.json();
  } catch {
    return { kind: "unknown" };
  }

  if (body.dryRun) return { kind: "sent", recipients: plan.recipientEstimate, automated: plan.automate ? "on" : null };

  const result = body.result;
  if (result?.ok) {
    const automated = result.automated ? (result.automated.ok ? "on" : "failed") : null;
    return { kind: "sent", recipients: result.recipientCount, automated };
  }
  if (result?.offerLive) return { kind: "offer-live-message-failed", error: result.error };
  return { kind: "failed", error: result?.error ?? body.message ?? "Fanvue said no." };
}
