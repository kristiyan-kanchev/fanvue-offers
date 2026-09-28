import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { refreshSession } from "@/lib/oauth";
import { openSession, sealSession, SESSION_COOKIE_OPTIONS } from "@/lib/session-token";
import { refreshDue } from "@/lib/token-refresh";

export async function proxy(request: NextRequest) {
  if (crossSiteWrite(request)) {
    return NextResponse.json({ error: "forbidden", message: "That request came from another site." }, { status: 403 });
  }
  return (await refreshedSession(request)) ?? NextResponse.next();
}

/**
 * Refreshes an expiring Fanvue token before a page renders. A render can't set
 * cookies, so a token refreshed there would be lost and its single-use refresh
 * token spent twice. The new session goes on the response, and into this
 * request's cookie header so the page sees it too.
 */
async function refreshedSession(request: NextRequest): Promise<NextResponse | null> {
  const token = request.cookies.get(env.SESSION_COOKIE_NAME)?.value;
  const session = token ? await openSession(token, env.SESSION_SECRET) : null;
  if (!session || !refreshDue(session, Date.now())) return null;

  const refreshed = await refreshSession(session);
  if (!refreshed) return null;

  const sealed = await sealSession(refreshed, env.SESSION_SECRET);
  request.cookies.set(env.SESSION_COOKIE_NAME, sealed);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(env.SESSION_COOKIE_NAME, sealed, SESSION_COOKIE_OPTIONS);
  return response;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * API writes must come from this app's pages. A forged request needs a browser
 * to carry the victim's cookie, and browsers always say where a request came
 * from: Origin, or Sec-Fetch-Site without it.
 */
export function crossSiteWrite(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method) || !request.nextUrl.pathname.startsWith("/api/")) return false;

  const origin = request.headers.get("origin");
  if (origin) return origin !== request.nextUrl.origin && origin !== new URL(env.BASE_URL).origin;

  const site = request.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)"],
};
