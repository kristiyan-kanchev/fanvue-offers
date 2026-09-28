import { describe, expect, it } from "vitest";
import { messageProblem } from "./message-check";

const discount = { type: "discount" as const, percent: 30 };
const trial = { type: "trial" as const, days: 7 };

describe("what a message may promise", () => {
  it("passes a message that says what the offer gives", () => {
    expect(messageProblem(discount, "Come back for 30% off your next month, until 2 Oct.")).toBeNull();
    expect(messageProblem(trial, "Try me with 7 days free. It's open until 9 Oct.")).toBeNull();
    expect(messageProblem(trial, "Here's a free week to see what you've missed.")).toBeNull();
    expect(messageProblem(null, "Auto-renew is off, so your subscription ends soon. Thanks for being here.")).toBeNull();
  });

  it("stops a discount message that names another discount, or free time", () => {
    expect(messageProblem(discount, "40% off!")).toMatch(/says 40% off/);
    expect(messageProblem(discount, "40 percent off your month")).toMatch(/says 40% off/);
    expect(messageProblem(discount, "Half price for you.")).toMatch(/says 50% off/);
    expect(messageProblem(discount, "30% off, and a free trial too")).toMatch(/free time/);
    expect(messageProblem(discount, "30% off plus 7 days free")).toMatch(/free time/);
  });

  it("stops a trial message that names money off, or another length", () => {
    expect(messageProblem(trial, "Come back for 40% off")).toMatch(/money off/);
    expect(messageProblem(trial, "Half price this month")).toMatch(/money off/);
    expect(messageProblem(trial, "14 free days on me")).toMatch(/says 14 days/);
    expect(messageProblem(trial, "Enjoy a 3-day trial")).toMatch(/says 3 days/);
    expect(messageProblem(trial, "Two weeks free, on me")).toMatch(/says 14 days/);
  });

  it("stops a message with no offer that promises one", () => {
    expect(messageProblem(null, "Here's 20% off to stay")).toMatch(/money off/);
    expect(messageProblem(null, "I've got a discount for you")).toMatch(/money off/);
    expect(messageProblem(null, "Start a free trial today")).toMatch(/free time/);
    expect(messageProblem(null, "Enjoy 7 days free")).toMatch(/free time/);
  });

  it("doesn't mistake ordinary time for an offer", () => {
    expect(messageProblem(null, "It's been a week since you left, and I'd love you back.")).toBeNull();
    expect(messageProblem(discount, "30% off, and it ends in 3 days.")).toBeNull();
  });

  it("stops a gap, and an empty message", () => {
    expect(messageProblem(null, "Next month: [what's coming]")).toMatch(/brackets/);
    expect(messageProblem(null, "  ")).toMatch(/Write a message/);
  });
});

describe("the built-in wording", () => {
  it("passes the check for every approach at every offer value", async () => {
    const { APPROACHES } = await import("./approaches");
    const { templateDraft } = await import("./draft-copy");
    for (const approaches of Object.values(APPROACHES)) {
      for (const approach of approaches) {
        for (const value of approach.offer?.choices ?? [undefined]) {
          const offer =
            approach.offer?.type === "discount"
              ? { type: "discount" as const, percent: value! }
              : approach.offer
                ? { type: "trial" as const, days: value! }
                : null;
          const text = templateDraft({
            approach: approach.id,
            creatorName: "Maya",
            voiceSamples: [],
            recipientCount: 10,
            offer,
            endsAt: offer ? "2026-10-02T23:59:59.000Z" : null,
            topUnsubscribeReason: "price",
          });
          const problem = messageProblem(offer, text);
          // A [gap] is expected: the creator fills it in. Anything else is a bug.
          expect(problem === null || /brackets/.test(problem), `${approach.id} ${value}: ${problem}`).toBe(true);
        }
      }
    }
  });
});
