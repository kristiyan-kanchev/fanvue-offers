import { describe, expect, it } from "vitest";
import { dayOneReport, isDayOne } from "@/audit/rules/day-one";
import { createFixtureSource } from "./fixture-source";

const NOW = new Date("2026-09-23T12:00:00.000Z");

describe("fixture source", () => {
  it("gives Maya an account with a ladder to audit", async () => {
    const snapshot = await createFixtureSource({ persona: "maya", now: () => NOW }).getSnapshot();
    expect(isDayOne(snapshot)).toBe(false);
    expect(snapshot.creator.displayName).toContain("Maya");
  });

  it("gives the day-one creator no subscribers and no followers", async () => {
    const snapshot = await createFixtureSource({ persona: "day-one", now: () => NOW }).getSnapshot();
    expect(isDayOne(snapshot)).toBe(true);
    expect(snapshot.creator.displayName).toBe("Sam Okonjo");
  });

  it("starts the day-one creator with nothing set up", async () => {
    const snapshot = await createFixtureSource({ persona: "day-one", now: () => NOW }).getSnapshot();
    const report = dayOneReport(snapshot);
    expect(report.items.map((item) => [item.id, item.done])).toEqual([
      ["price", false],
      ["welcome", false],
      ["trial-link", false],
    ]);
  });

  it("shows the welcome flow's choices the way Fanvue would after the real calls", async () => {
    const snapshot = await createFixtureSource({
      persona: "day-one",
      now: () => NOW,
      setup: { price: 799, welcome: "Welcome in. Start with the pinned post.", trialDays: 7 },
    }).getSnapshot();
    const report = dayOneReport(snapshot);
    expect(report.completedCount).toBe(3);
    expect(report.items.map((item) => item.detail)).toEqual([
      "US$7.99 a month",
      "Welcome in. Start with the pinned post.",
      "7 days free",
    ]);
    expect(report.items[2].url).toBe("https://www.fanvue.com/samokonjo?trial=demo");
    // Still an account with no fans, so it stays on its setup dashboard.
    expect(isDayOne(snapshot)).toBe(true);
  });

  it("defaults to Maya", async () => {
    const snapshot = await createFixtureSource({ now: () => NOW }).getSnapshot();
    expect(isDayOne(snapshot)).toBe(false);
  });
});
