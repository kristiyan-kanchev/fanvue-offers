import { describe, expect, it } from "vitest";
import { APPROACHES } from "@/actions/approaches";
import { describeRequests, executeBody } from "@/actions/plan";
import { planFromEdits, preparePlan } from "@/actions/registry";
import { mayaSnapshot } from "@/test/helpers";
import { messageProblem as checkMessage } from "./message-check";

const DEMO_BUDGET = { budget: "demo" as const };

describe("what the creator sees is what gets sent", () => {
  it("rebuilds exactly the plan on screen, for every approach", async () => {
    const snapshot = await mayaSnapshot();
    for (const [kind, approaches] of Object.entries(APPROACHES) as [keyof typeof APPROACHES, (typeof APPROACHES)["winback"]][]) {
      for (const approach of approaches) {
        const value = approach.offer?.choices[0];
        const { plan } = (await preparePlan(kind, snapshot, { approach: approach.id, ...(value ? { value } : {}) }, DEMO_BUDGET))!;
        const text = "Edited by the creator.";

        const shown = { ...plan, messageText: text, automate: kind === "renewal" };
        const sent = planFromEdits(kind, snapshot, executeBody(shown, text));
        expect(sent, approach.id).not.toBeNull();
        expect(describeRequests(sent!), approach.id).toEqual(describeRequests(shown));
      }
    }
  });
});

describe("what stops a message going out", () => {
  it("a number that doesn't match the offer", async () => {
    const { plan } = (await preparePlan("winback", await mayaSnapshot(), { approach: "comeback-discount", value: 30 }, DEMO_BUDGET))!;
    expect(checkMessage(plan.offer, plan.messageText)).toBeNull();
    expect(checkMessage(plan.offer, "Come back for 40% off.")).toBe("The message says 40% off, but your offer is 30% off.");
  });

  it("a trial length that doesn't match", async () => {
    const { plan } = (await preparePlan("front-door", await mayaSnapshot(), { approach: "free-trial", value: 3 }, DEMO_BUDGET))!;
    expect(checkMessage(plan.offer, plan.messageText)).toBeNull();
    expect(checkMessage(plan.offer, "Try me 14 days free.")).toBe("The message says 14 days, but your offer is 3 days free.");
  });

  it("a gap only the creator can fill, until they fill it", async () => {
    const { plan } = (await preparePlan("renewal", await mayaSnapshot(), { approach: "whats-coming" }, DEMO_BUDGET))!;
    expect(checkMessage(plan.offer, plan.messageText)).toBe("Fill in the part in [brackets] first.");
    expect(checkMessage(plan.offer, plan.messageText.replace(/\[[^\]]+\]/, "a new 6-week plan"))).toBeNull();
  });

  it("an empty message", async () => {
    const { plan } = (await preparePlan("renewal", await mayaSnapshot(), {}, DEMO_BUDGET))!;
    expect(checkMessage(plan.offer, "   ")).toBe("Write a message first.");
  });
});
