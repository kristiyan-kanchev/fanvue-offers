import { cookies } from "next/headers";
import { env } from "@/env";
import type { ActionPlan } from "@/actions/plan";
import type { DemoPersona, DemoSend, DemoSetup } from "@/data/types";
import { openSession, sealSession, SESSION_COOKIE_OPTIONS, type SessionPayload } from "./session-token";

export async function setSession(payload: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, await sealSession(payload, env.SESSION_SECRET), SESSION_COOKIE_OPTIONS);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  return token ? openSession(token, env.SESSION_SECRET) : null;
}

export async function clearSession() {
  (await cookies()).delete(env.SESSION_COOKIE_NAME);
}

export async function startDemoSession(creator: DemoPersona = "maya") {
  await setSession({ mode: "demo", demoCreator: creator });
}

// Demo text lives in the cookie, which browsers silently drop over 4 KB. A preview is enough.
export const DEMO_TEXT_MAX = 500;

export function demoText(text: string): string {
  return text.length <= DEMO_TEXT_MAX ? text : `${text.slice(0, DEMO_TEXT_MAX - 1).trimEnd()}…`;
}

/** Starting or switching the demo creator clears these. */
export async function recordDemoSend(plan: ActionPlan, now: Date) {
  const session = await getSession();
  if (session?.mode !== "demo") return;
  const send: DemoSend = {
    kind: plan.kind,
    approach: plan.approach,
    at: now.toISOString(),
    recipients: plan.recipientEstimate,
    offer: plan.offer,
    endsAt: plan.endsAt,
    ...(plan.automate && { automatedText: demoText(plan.messageText) }),
  };
  await setSession({ ...session, demoSent: [...(session.demoSent ?? []), send] });
}

export async function recordDemoSetup(patch: DemoSetup) {
  const session = await getSession();
  if (session?.mode !== "demo") return;
  const kept = patch.welcome ? { ...patch, welcome: demoText(patch.welcome) } : patch;
  await setSession({ ...session, demoSetup: { ...session.demoSetup, ...kept } });
}

export async function markOnboarded() {
  const session = await getSession();
  if (session) await setSession({ ...session, onboarded: true });
}
