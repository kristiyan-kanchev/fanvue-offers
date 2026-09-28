import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSession, sealSession, type SessionPayload } from "@/lib/session-token";
import { createTokenRefresher, refreshDue } from "@/lib/token-refresh";

const MINUTE = 60_000;

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/oauth", () => ({ refreshSession: refresh }));

const SECRET = process.env.SESSION_SECRET!;
const COOKIE = process.env.SESSION_COOKIE_NAME ?? "fanvue_oauth";

const live: SessionPayload = {
  mode: "live",
  onboarded: true,
  accessToken: "AT0",
  refreshToken: "RT0",
  expiresAt: 1_000_000,
};

describe("when a token is due", () => {
  it("is due a minute before it expires, and only for a live session with a refresh token", () => {
    expect(refreshDue(live, 1_000_000 - MINUTE - 1)).toBe(false);
    expect(refreshDue(live, 1_000_000 - MINUTE)).toBe(true);
    expect(refreshDue({ ...live, refreshToken: undefined }, 2_000_000)).toBe(false);
    expect(refreshDue({ mode: "demo" }, 2_000_000)).toBe(false);
  });
});

describe("the refresher", () => {
  const tokens = { access_token: "AT1", refresh_token: "RT1", expires_in: 3600 };

  it("spends a refresh token once, however many requests arrive with it", async () => {
    const call = vi.fn().mockResolvedValue(tokens);
    const refreshSession = createTokenRefresher(call, () => 0);
    const [a, b] = await Promise.all([refreshSession(live), refreshSession(live)]);
    const c = await refreshSession(live);
    expect(call).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(c?.accessToken).toBe("AT1");
  });

  it("keeps the rest of the session: mode and onboarded", async () => {
    const refreshSession = createTokenRefresher(vi.fn().mockResolvedValue(tokens), () => 5);
    expect(await refreshSession(live)).toEqual({
      ...live,
      accessToken: "AT1",
      refreshToken: "RT1",
      expiresAt: 5 + 3_600_000,
    });
  });

  it("keeps the old refresh token when the server doesn't rotate it", async () => {
    const call = vi.fn().mockResolvedValue({ access_token: "AT1", expires_in: 60 });
    expect((await createTokenRefresher(call)(live))?.refreshToken).toBe("RT0");
  });

  it("returns null when the refresh fails, so the caller can ask for a reconnect", async () => {
    const call = vi.fn().mockRejectedValue(new Error("invalid_grant"));
    expect(await createTokenRefresher(call)(live)).toBeNull();
  });

  it("refreshes again once the shared result is a minute old", async () => {
    let t = 0;
    const call = vi.fn().mockResolvedValue(tokens);
    const refreshSession = createTokenRefresher(call, () => t);
    await refreshSession(live);
    t = 61_000;
    await refreshSession(live);
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("the proxy", () => {
  beforeEach(() => refresh.mockReset());

  async function request(session: SessionPayload) {
    const jwt = await sealSession(session, SECRET);
    return new NextRequest("http://localhost:3000/audit", { headers: { cookie: `${COOKIE}=${jwt}` } });
  }

  it("refreshes an expiring token before the page renders, and writes it back", async () => {
    const { proxy } = await import("@/proxy");
    refresh.mockResolvedValue({ ...live, accessToken: "AT1", refreshToken: "RT1", expiresAt: Date.now() + 3_600_000 });

    const response = await proxy(await request({ ...live, expiresAt: Date.now() + 10_000 }));
    const written = response.cookies.get(COOKIE)?.value;
    expect(written).toBeTruthy();
    expect(await openSession(written!, SECRET)).toMatchObject({ accessToken: "AT1", onboarded: true });
    // The page in this same request reads the new cookie too.
    expect(response.headers.get("x-middleware-request-cookie")).toContain(written);
  });

  it("leaves a fresh token alone", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(await request({ ...live, expiresAt: Date.now() + 3_600_000 }));
    expect(refresh).not.toHaveBeenCalled();
    expect(response.cookies.get(COOKIE)).toBeUndefined();
  });

  it("carries on with the old session when the refresh fails", async () => {
    const { proxy } = await import("@/proxy");
    refresh.mockResolvedValue(null);
    const response = await proxy(await request({ ...live, expiresAt: Date.now() }));
    expect(response.cookies.get(COOKIE)).toBeUndefined();
  });
});

describe("writes from another site", () => {
  const post = (path: string, headers: Record<string, string>) =>
    new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers });

  it("turns away a POST whose Origin is another site", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(post("/api/session", { origin: "https://evil.example", "content-type": "text/plain" }));
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("turns away a cross-site request that has no Origin but says where it came from", async () => {
    const { crossSiteWrite } = await import("@/proxy");
    expect(crossSiteWrite(post("/api/actions/winback", { "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("lets the app's own pages through, and reads", async () => {
    const { crossSiteWrite } = await import("@/proxy");
    expect(crossSiteWrite(post("/api/session", { origin: "http://localhost:3000" }))).toBe(false);
    expect(crossSiteWrite(post("/api/session", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(crossSiteWrite(new NextRequest("http://localhost:3000/api/snapshot", { headers: { origin: "https://evil.example" } }))).toBe(false);
  });
});
