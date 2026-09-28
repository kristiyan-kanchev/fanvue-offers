import type { FanvueClient } from "@/fanvue/client";
import { postJson, putJson } from "@/fanvue/typed";
import { stepsFor, type ActionPlan } from "./plan";

type Outcome = { ok: true } | { ok: false; error: string };

type ExecuteResult =
  | {
      ok: true;
      promotionUuid: string | null;
      massMessageUuid: string;
      recipientCount: number;
      /** Only when asked for. Its failure never fails the fix: the message has gone. */
      automated?: Outcome;
    }
  /** offerLive: the offer went out and only the message failed, so resend just the message. */
  | { ok: false; offerLive: boolean; error: string };

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * The offer (unless `messageOnly`), then the message. The message carries the
 * plan's idempotency key, so Fanvue replays a resend instead of delivering it twice.
 */
export async function executeAction(
  plan: ActionPlan,
  client: FanvueClient,
  { messageOnly = false } = {},
): Promise<ExecuteResult> {
  const steps = stepsFor(plan);

  let promotionUuid: string | null = null;
  if (steps.promotion && !messageOnly) {
    try {
      promotionUuid = (await postJson(client, "/promotions", steps.promotion)).uuid;
    } catch (cause) {
      return { ok: false, offerLive: false, error: errorText(cause) };
    }
  }

  let message;
  try {
    message = await postJson(client, "/chats/mass-messages", steps.message, { "Idempotency-Key": plan.idempotencyKey });
  } catch (cause) {
    return { ok: false, offerLive: promotionUuid !== null || messageOnly, error: errorText(cause) };
  }

  let automated: Outcome | undefined;
  if (steps.automation) {
    const { trigger, body } = steps.automation;
    automated = await putJson(client, "/chats/automated-messages/{trigger}", { trigger }, body).then(
      () => ({ ok: true }) as const,
      (cause) => ({ ok: false, error: errorText(cause) }) as const,
    );
  }

  return {
    ok: true,
    promotionUuid,
    massMessageUuid: message.uuid,
    recipientCount: message.recipientCount,
    ...(automated && { automated }),
  };
}
