import { EncryptJWT, jwtDecrypt } from "jose";
import type { DemoPersona, DemoSend, DemoSetup } from "@/data/types";

// Encrypted, not just signed: the cookie carries Fanvue tokens, so whoever sees
// it (a log, a proxy, a screenshot of devtools) can neither read nor forge it.
// No Next.js request APIs here, so the proxy can use it too.

export type SessionPayload = {
  mode: "live" | "demo";
  demoCreator?: DemoPersona;
  demoSent?: DemoSend[];
  demoSetup?: DemoSetup;
  /** The welcome flow has been seen, so an empty account lands on its dashboard. */
  onboarded?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: THIRTY_DAYS_SECONDS,
} as const;

const keys = new Map<string, Promise<Uint8Array>>();

/** A 256-bit key from the secret, whatever its length. */
function key(secret: string): Promise<Uint8Array> {
  let derived = keys.get(secret);
  if (!derived) {
    derived = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(secret))
      .then((digest) => new Uint8Array(digest));
    keys.set(secret, derived);
  }
  return derived;
}

export async function sealSession(payload: SessionPayload, secret: string): Promise<string> {
  // A decoded payload carries jose's own iat and exp; they are stamped afresh.
  const { iat: _iat, exp: _exp, ...claims } = payload as SessionPayload & { iat?: number; exp?: number };
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS_SECONDS}s`)
    .encrypt(await key(secret));
}

/** Null for anything this server didn't write, including an expired or tampered cookie. */
export async function openSession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtDecrypt<SessionPayload>(token, await key(secret));
    return payload.mode === "live" || payload.mode === "demo" ? payload : null;
  } catch {
    return null;
  }
}
