import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { exchangeCode } from "@/lib/oauth";
import { setSession } from "@/lib/session";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, env.BASE_URL));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_verifier")?.value;
  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_verifier");

  const error = params.get("error");
  if (error) return redirectTo(`/?${new URLSearchParams({ error })}`);

  const code = params.get("code");
  if (!code || !verifier || !expectedState || params.get("state") !== expectedState) {
    return redirectTo("/?error=oauth_state_mismatch");
  }

  try {
    const token = await exchangeCode(code, verifier);
    await setSession({
      mode: "live",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });
    return redirectTo("/audit");
  } catch {
    return redirectTo("/?error=oauth_token_exchange_failed");
  }
}
