import type { SessionPayload } from "./session-token";

const REFRESH_WINDOW_MS = 60_000;
const SHARE_RESULT_MS = 60_000;

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Refresh a minute early, rather than waiting for a 401. */
export function refreshDue(session: SessionPayload, now: number): boolean {
  return (
    session.mode === "live" &&
    Boolean(session.refreshToken) &&
    session.expiresAt !== undefined &&
    now >= session.expiresAt - REFRESH_WINDOW_MS
  );
}

/**
 * Fanvue's refresh tokens are single use, and spending one twice revokes the
 * login. A page load sends several requests with the same cookie, so the
 * first one refreshes and the rest reuse its result for a minute.
 */
export function createTokenRefresher(
  refresh: (refreshToken: string) => Promise<TokenResponse>,
  now: () => number = Date.now,
) {
  const recent = new Map<string, { at: number; result: Promise<TokenResponse | null> }>();

  return async function refreshSession(session: SessionPayload): Promise<SessionPayload | null> {
    const token = session.refreshToken;
    if (!token) return null;

    for (const [key, entry] of recent) {
      if (now() - entry.at > SHARE_RESULT_MS) recent.delete(key);
    }
    if (!recent.has(token)) {
      recent.set(token, { at: now(), result: refresh(token).catch(() => null) });
    }

    const tokens = await recent.get(token)!.result;
    if (!tokens) return null;
    return {
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? token,
      expiresAt: now() + tokens.expires_in * 1000,
    };
  };
}
