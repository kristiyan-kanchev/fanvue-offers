import { describe, expect, it } from "vitest";
import { fakeClient } from "@/test/helpers";
import { templateDraft } from "./draft-copy";
import { PLACEHOLDER } from "./approaches";
import { SETUP_REQUEST, runSetupStep } from "./setup";

describe("the welcome flow's calls", () => {
  it("sets the price in cents", async () => {
    const { client, calls } = fakeClient(() => ({ status: 200, body: { subscriptionPrice: 799 } }));
    await runSetupStep(client, { step: "price", cents: 799 });
    expect(calls).toMatchObject([
      { method: "PATCH", path: "/users/me/subscription-price", body: { subscriptionPrice: 799 } },
    ]);
  });

  it("turns on the welcome message for new subscribers", async () => {
    const { client, calls } = fakeClient(() => ({ status: 200, body: { trigger: "new_subscriber", enabled: true } }));
    await runSetupStep(client, { step: "welcome", text: "Welcome in." });
    expect(calls).toMatchObject([
      { method: "PUT", path: "/chats/automated-messages/new_subscriber", body: { text: "Welcome in." } },
    ]);
  });

  it("creates a trial link and hands back its URL", async () => {
    const { client, calls } = fakeClient(() => ({
      status: 201,
      body: { uuid: "l-1", url: "https://www.fanvue.com/sam?trial=abc", trialDurationDays: 7 },
    }));
    expect(await runSetupStep(client, { step: "trial-link", days: 7 })).toEqual({
      url: "https://www.fanvue.com/sam?trial=abc",
    });
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/free-trial-links",
      body: { trialDurationDays: 7, name: "Offers" },
    });
  });
});

describe("what the server refuses", () => {
  it("a price outside Fanvue's US$3.99 to US$100", () => {
    expect(SETUP_REQUEST.safeParse({ step: "price", cents: 399 }).success).toBe(true);
    expect(SETUP_REQUEST.safeParse({ step: "price", cents: 398 }).success).toBe(false);
    expect(SETUP_REQUEST.safeParse({ step: "price", cents: 10_001 }).success).toBe(false);
  });

  it("a welcome message with a gap still in it", () => {
    expect(SETUP_REQUEST.safeParse({ step: "welcome", text: "Hi [what to look at]" }).success).toBe(false);
    expect(SETUP_REQUEST.safeParse({ step: "welcome", text: "Hi, start with the pinned post." }).success).toBe(true);
  });

  it("a trial longer than 30 days", () => {
    expect(SETUP_REQUEST.safeParse({ step: "trial-link", days: 31 }).success).toBe(false);
  });
});

describe("the drafted welcome message", () => {
  it("leaves the creator one gap to fill, and invents nothing about the page", () => {
    const text = templateDraft({
      approach: "welcome",
      creatorName: "Sam Okonjo",
      voiceSamples: [],
      recipientCount: 0,
      offer: null,
      endsAt: null,
    });
    expect(text).toContain("Sam Okonjo");
    expect(text.match(new RegExp(PLACEHOLDER.source, "g"))).toHaveLength(1);
  });
});
