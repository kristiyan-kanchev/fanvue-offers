import { describe, expect, it } from "vitest";
import { fakeClient, mayaSnapshot } from "@/test/helpers";
import { APPROACHES, approachFor, recommendedApproach, type ApproachId } from "./approaches";
import { executeAction } from "./execute";
import { buildPlan, describeRequests, stepsFor } from "./plan";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const KEY = "key-0001";

const approach = (id: ApproachId) =>
  Object.values(APPROACHES)
    .flat()
    .find((a) => a.id === id)!;

async function plan(id: ApproachId, value?: number) {
  return buildPlan(approach(id), await mayaSnapshot(), "Hi.", {
    now: NOW,
    idempotencyKey: KEY,
    ...(value !== undefined ? { value } : {}),
  });
}

describe("every problem has more than one way to fix it", () => {
  it("offers two or three approaches per problem, each one Fanvue can do", () => {
    expect(APPROACHES.winback.map((a) => a.id)).toEqual(["comeback-discount", "free-week-back", "just-ask"]);
    expect(APPROACHES["front-door"].map((a) => a.id)).toEqual(["free-trial", "first-month-off", "personal-invite"]);
    expect(APPROACHES.renewal.map((a) => a.id)).toEqual(["friendly-reminder", "whats-coming"]);
    // No promotion group reaches the non-renewing list, so no renewal approach has an offer.
    expect(APPROACHES.renewal.every((a) => a.offer === null)).toBe(true);
  });

  it("only accepts an approach for its own problem", () => {
    expect(approachFor("winback", "free-trial")).toBeNull();
    expect(approachFor("winback", "nonsense")).toBeNull();
    expect(approachFor("winback", "just-ask")?.id).toBe("just-ask");
  });

  it("suggests a discount when fans left over price, and a free week back otherwise", () => {
    expect(recommendedApproach("winback", { leftOverPrice: true }).id).toBe("comeback-discount");
    expect(recommendedApproach("winback", { leftOverPrice: false }).id).toBe("free-week-back");
    expect(recommendedApproach("front-door").id).toBe("free-trial");
  });
});

describe("buildPlan", () => {
  it("applies the approach's defaults: 40% off, open 7 days, sized by the list", async () => {
    const p = await plan("comeback-discount");
    expect(p.offer).toEqual({ type: "discount", percent: 40 });
    expect(p.endsAt).toBe("2026-09-30T23:59:59.000Z");
    expect(p.recipientEstimate).toBe(178);
  });

  it("builds each kind of offer, or none", async () => {
    expect(stepsFor(await plan("free-week-back", 3)).promotion).toEqual({
      availableToGroup: "expired_subscribers",
      freeTrial: true,
      freeTrialDays: 3,
      endsAt: "2026-09-30T23:59:59.000Z",
      notifyFans: false,
    });
    expect(stepsFor(await plan("first-month-off", 20)).promotion).toEqual({
      availableToGroup: "followers",
      discountPercent: 20,
      endsAt: "2026-10-07T23:59:59.000Z",
      notifyFans: false,
    });
    const justAsk = await plan("just-ask");
    expect(justAsk.offer).toBeNull();
    expect(justAsk.endsAt).toBeNull();
    expect(stepsFor(justAsk).promotion).toBeNull();
  });

  it("messages the right list, and keeps paying subscribers out of new-fan offers", async () => {
    expect(stepsFor(await plan("just-ask")).message.includedLists).toEqual({ smartListIds: ["expired_subscribers"] });
    expect(stepsFor(await plan("personal-invite")).message).toMatchObject({
      includedLists: { smartListIds: ["followers"] },
      excludedLists: { smartListIds: ["subscribers"] },
    });
    expect(stepsFor(await plan("whats-coming")).message.includedLists).toEqual({ smartListIds: ["non_renewing"] });
  });

  it("generates a fresh idempotency key when none is supplied", async () => {
    const a = buildPlan(approach("just-ask"), await mayaSnapshot(), "One");
    const b = buildPlan(approach("just-ask"), await mayaSnapshot(), "Two");
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });

  it("describes the requests it will make", async () => {
    const requests = describeRequests(await plan("comeback-discount"));
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(["POST /promotions", "POST /chats/mass-messages"]);
  });
});

describe("executeAction", () => {
  it("creates the offer, then sends the message with the plan's key", async () => {
    const { client, calls } = fakeClient((call) =>
      call.path === "/promotions"
        ? { status: 201, body: { uuid: "promo-1", usedCount: 0 } }
        : { status: 201, body: { uuid: "msg-1", publishedAt: "2026-09-23", recipientCount: 178 } },
    );
    const result = await executeAction(await plan("comeback-discount"), client);
    expect(result).toEqual({ ok: true, promotionUuid: "promo-1", massMessageUuid: "msg-1", recipientCount: 178 });
    expect(calls.map((c) => c.path)).toEqual(["/promotions", "/chats/mass-messages"]);
    expect(calls[1].headers["Idempotency-Key"]).toBe(KEY);
  });

  it("sends only a message for an approach with no offer", async () => {
    const { client, calls } = fakeClient(() => ({ status: 201, body: { uuid: "msg-1", recipientCount: 178 } }));
    expect(await executeAction(await plan("just-ask"), client)).toMatchObject({ ok: true, promotionUuid: null });
    expect(calls.map((c) => c.path)).toEqual(["/chats/mass-messages"]);
  });

  it("says the offer is live when only the message failed, and a resend never makes a second offer", async () => {
    let messageAttempts = 0;
    const { client, calls } = fakeClient((call) => {
      if (call.path === "/promotions") return { status: 201, body: { uuid: "promo-1" } };
      messageAttempts += 1;
      return messageAttempts === 1
        ? { status: 502, body: { message: "Fanvue is down" } }
        : { status: 201, body: { uuid: "msg-1", recipientCount: 178 } };
    });
    const p = await plan("comeback-discount");

    expect(await executeAction(p, client)).toEqual({ ok: false, offerLive: true, error: "Fanvue is down" });
    expect(await executeAction(p, client, { messageOnly: true })).toMatchObject({ ok: true });
    expect(calls.filter((c) => c.path === "/promotions")).toHaveLength(1);
    expect(calls.filter((c) => c.path === "/chats/mass-messages").map((c) => c.headers["Idempotency-Key"])).toEqual([KEY, KEY]);
  });

  it("reports nothing created when the offer itself fails, or a message-only fix fails", async () => {
    const failing = fakeClient(() => ({ status: 400, body: { message: "bad group" } }));
    expect(await executeAction(await plan("comeback-discount"), failing.client)).toEqual({
      ok: false,
      offerLive: false,
      error: "bad group",
    });
    expect(failing.calls).toHaveLength(1);
    expect(await executeAction(await plan("friendly-reminder"), failing.client)).toMatchObject({ offerLive: false });
  });
});

describe("the automatic reminder", () => {
  const withAutomate = async (id: ApproachId) =>
    buildPlan(approach(id), await mayaSnapshot(), "Auto-renew is off.", { now: NOW, idempotencyKey: KEY, automate: true });

  it("turns the reminder into Fanvue's automatic message for auto-renew switched off", async () => {
    const steps = stepsFor(await withAutomate("friendly-reminder"));
    expect(steps.automation).toEqual({ trigger: "subscription_canceled", body: { text: "Auto-renew is off." } });
    expect(describeRequests(await withAutomate("friendly-reminder")).map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /chats/mass-messages",
      "PUT /chats/automated-messages/subscription_canceled",
    ]);
  });

  it("is ignored for anything but a renewal", async () => {
    const plan = await withAutomate("comeback-discount");
    expect(plan.automate).toBeUndefined();
    expect(stepsFor(plan).automation).toBeNull();
  });

  it("switches on after the message, and its failure never fails the fix", async () => {
    const ok = fakeClient(() => ({ status: 201, body: { uuid: "msg-1", recipientCount: 358 } }));
    expect(await executeAction(await withAutomate("friendly-reminder"), ok.client)).toMatchObject({
      ok: true,
      automated: { ok: true },
    });
    expect(ok.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /chats/mass-messages",
      "PUT /chats/automated-messages/subscription_canceled",
    ]);

    const flaky = fakeClient((call) =>
      call.method === "PUT"
        ? { status: 500, body: { message: "try later" } }
        : { status: 201, body: { uuid: "msg-1", recipientCount: 358 } },
    );
    expect(await executeAction(await withAutomate("friendly-reminder"), flaky.client)).toMatchObject({
      ok: true,
      automated: { ok: false, error: "try later" },
    });
  });

  it("isn't attempted when the message itself fails", async () => {
    const failing = fakeClient(() => ({ status: 502, body: { message: "down" } }));
    await executeAction(await withAutomate("friendly-reminder"), failing.client);
    expect(failing.calls).toHaveLength(1);
  });
});
