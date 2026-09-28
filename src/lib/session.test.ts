import { describe, expect, it } from "vitest";
import { demoText, DEMO_TEXT_MAX } from "./session";
import { openSession, sealSession, type SessionPayload } from "./session-token";

describe("the demo session cookie", () => {
  it("cuts long text to a preview", () => {
    expect(demoText("short")).toBe("short");
    const cut = demoText("x".repeat(4500));
    expect(cut.length).toBe(DEMO_TEXT_MAX);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("stays under the 4 KB browsers allow, even at its largest", async () => {
    const long = demoText("A very long message. ".repeat(300));
    const sent = (["winback", "front-door", "renewal"] as const).map((kind) => ({
      kind,
      approach: kind === "renewal" ? ("friendly-reminder" as const) : ("comeback-discount" as const),
      at: new Date().toISOString(),
      recipients: 2156,
      offer: kind === "renewal" ? null : { type: "discount" as const, percent: 40 },
      endsAt: kind === "renewal" ? null : new Date().toISOString(),
      ...(kind === "renewal" ? { automatedText: long } : {}),
    }));
    const session: SessionPayload = {
      mode: "demo",
      demoCreator: "day-one",
      demoSent: sent,
      demoSetup: { price: 999, welcome: long, trialDays: 7 },
      onboarded: true,
    };
    const cookie = `offer_ladder_session=${await sealSession(session, "test-session-secret-value")}`;
    expect(cookie.length).toBeLessThan(4096);
  });
});

describe("the session cookie", () => {
  const SECRET = "test-session-secret-value";
  const live: SessionPayload = { mode: "live", accessToken: "access-token-123", refreshToken: "refresh-token-456", expiresAt: 1 };

  it("round-trips a session", async () => {
    expect(await openSession(await sealSession(live, SECRET), SECRET)).toMatchObject(live);
  });

  it("never carries the Fanvue tokens where they can be read", async () => {
    const sealed = await sealSession(live, SECRET);
    const readable = sealed
      .split(".")
      .map((part) => Buffer.from(part, "base64url").toString("latin1"))
      .join("");
    expect(readable).not.toContain("access-token-123");
    expect(readable).not.toContain("refresh-token-456");
  });

  it("refuses a cookie that was changed, or sealed with another secret", async () => {
    const sealed = await sealSession(live, SECRET);
    const parts = sealed.split(".");
    parts[3] = `${parts[3]!.slice(0, -2)}AA`;
    expect(await openSession(parts.join("."), SECRET)).toBeNull();
    expect(await openSession(sealed, "another-secret-entirely")).toBeNull();
    expect(await openSession("not-a-cookie", SECRET)).toBeNull();
  });
});
