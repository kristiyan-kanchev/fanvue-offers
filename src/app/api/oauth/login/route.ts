import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, generatePkce } from "@/lib/oauth";

const OAUTH_COOKIE = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 } as const;

export async function GET() {
  const { verifier, challenge } = generatePkce();
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, OAUTH_COOKIE);
  cookieStore.set("oauth_verifier", verifier, OAUTH_COOKIE);

  return NextResponse.redirect(authorizeUrl({ state, codeChallenge: challenge }));
}
