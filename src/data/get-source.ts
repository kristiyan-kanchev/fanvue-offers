import { getServerClient } from "@/fanvue/server-client";
import { getSession } from "@/lib/session";
import { createFixtureSource } from "./fixture-source";
import { createLiveSource } from "./live-source";
import type { CreatorData } from "./types";

export class NotConnectedError extends Error {
  constructor() {
    super("No Fanvue account is connected.");
    this.name = "NotConnectedError";
  }
}

/** The demo's fixtures or the live API, by the session's mode. Null when not connected. */
export async function getCreatorData({ force = false } = {}): Promise<CreatorData | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.mode === "demo") {
    return createFixtureSource({ persona: session.demoCreator, sent: session.demoSent, setup: session.demoSetup });
  }

  const client = await getServerClient();
  return client ? createLiveSource({ client, force }) : null;
}

export async function requireCreatorData(options?: { force?: boolean }): Promise<CreatorData> {
  const data = await getCreatorData(options);
  if (!data) throw new NotConnectedError();
  return data;
}
