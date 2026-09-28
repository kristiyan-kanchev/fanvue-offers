"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorData } from "@/data/get-source";
import { DEMO_PERSONAS, type DemoPersona } from "@/data/types";
import { revokeTokens } from "@/lib/oauth";
import { clearSession, getSession, startDemoSession } from "@/lib/session";

/** A brand new account starts in the welcome flow, like a real one would. */
export async function startDemo(persona: DemoPersona) {
  if (!DEMO_PERSONAS.includes(persona)) throw new Error("Unknown demo creator.");
  await startDemoSession(persona);
  redirect(persona === "day-one" ? "/welcome" : "/audit");
}

/** Disconnects, revoking the login at Fanvue, or leaves the demo. */
export async function leave() {
  const session = await getSession();
  if (session?.mode === "live") await revokeTokens(session);
  await clearSession();
  redirect("/");
}

/** Re-reads Fanvue, skipping the minute-long cache, and re-renders the page it was pressed on. */
export async function checkAgain() {
  await (await getCreatorData({ force: true }))?.getSnapshot().catch(() => undefined);
  refresh();
}
