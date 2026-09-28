import { createHash, randomBytes } from "node:crypto";
import { env } from "@/env";
import type { SessionPayload } from "./session-token";
import { createTokenRefresher, type TokenResponse } from "./token-refresh";

// Fanvue needs these on top of the app's own scopes for refresh tokens to work.
const BASE_SCOPES = "openid offline_access offline";

export function generatePkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.OAUTH_CLIENT_ID,
    redirect_uri: env.OAUTH_REDIRECT_URI,
    scope: `${BASE_SCOPES} ${env.OAUTH_SCOPES}`,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // Always ask, so a creator can switch accounts.
    prompt: "login",
  });
  return `${env.OAUTH_ISSUER_BASE_URL}/oauth2/auth?${params}`;
}

/** A form POST to the login server, authenticated as this app. */
function postForm(path: string, form: Record<string, string>, timeoutMs: number): Promise<Response> {
  const credentials = Buffer.from(`${env.OAUTH_CLIENT_ID}:${env.OAUTH_CLIENT_SECRET}`).toString("base64");
  return fetch(`${env.OAUTH_ISSUER_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ client_id: env.OAUTH_CLIENT_ID, ...form }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function requestToken(grant: Record<string, string>): Promise<TokenResponse> {
  const res = await postForm("/oauth2/token", grant, 10_000);
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: env.OAUTH_REDIRECT_URI,
  });
}

/**
 * Ends the login at Fanvue, so a copy of the cookie stops working too. Revoking
 * the refresh token revokes the access tokens it issued. Best effort: leaving
 * never waits on, or fails because of, Fanvue.
 */
export async function revokeTokens(session: SessionPayload): Promise<void> {
  const token = session.refreshToken ?? session.accessToken;
  if (!token) return;
  await postForm("/oauth2/revoke", { token }, 5_000).catch(() => undefined);
}

/** Shared by the proxy and the API client, so one process spends a refresh token once. */
export const refreshSession = createTokenRefresher((refreshToken) =>
  requestToken({ grant_type: "refresh_token", refresh_token: refreshToken }),
);
