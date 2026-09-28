import { refreshSession } from "@/lib/oauth";
import { getSession, setSession } from "@/lib/session";
import { createFanvueClient, type FanvueClient } from "./client";

/**
 * A client for the live session, or null in the demo or when not connected.
 * The proxy refreshes an expiring token before this runs; this only handles
 * the rare 401 on a token that should still be good.
 */
export async function getServerClient(): Promise<FanvueClient | null> {
  const session = await getSession();
  if (session?.mode !== "live" || !session.accessToken) return null;

  return createFanvueClient({
    accessToken: session.accessToken,
    refreshAccessToken: async () => {
      const refreshed = await refreshSession((await getSession()) ?? session);
      if (!refreshed) return null;
      // Cookies can only be written from a route handler, not during a page render.
      await setSession(refreshed).catch(() => undefined);
      return refreshed.accessToken ?? null;
    },
  });
}
