import { describe, expect, it, vi } from "vitest";
import { createMemoryStore, createUpstashStore, type Store } from "@/lib/store";
import { BUDGET_WINDOW_SECONDS, budgetFor, takeDraftBudget } from "./draft-budget";
import type { DraftInput } from "./draft-copy";
import { draftMessage } from "./draft-message";

const input: DraftInput = {
  approach: "friendly-reminder",
  creatorName: "Maya",
  voiceSamples: [],
  recipientCount: 10,
  offer: null,
  endsAt: null,
};

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("the shared drafting budget", () => {
  it("allows the limit, then says no until the hour is up", async () => {
    const time = clock();
    const store = createMemoryStore(time.now);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takeDraftBudget(store, 3));
    expect(results).toEqual([true, true, true, false]);

    time.advance(BUDGET_WINDOW_SECONDS * 1000 - 1);
    expect(await takeDraftBudget(store, 3)).toBe(false);
    time.advance(1);
    expect(await takeDraftBudget(store, 3)).toBe(true);
  });

  it("keeps the demo's budget apart from each creator's, and creators apart from each other", async () => {
    const store = createMemoryStore();
    for (let i = 0; i < 3; i++) await takeDraftBudget(store, 3, "demo");
    expect(await takeDraftBudget(store, 3, "demo")).toBe(false);
    expect(await takeDraftBudget(store, 3, { creator: "c1" })).toBe(true);
    for (let i = 0; i < 2; i++) await takeDraftBudget(store, 3, { creator: "c1" });
    expect(await takeDraftBudget(store, 3, { creator: "c1" })).toBe(false);
    expect(await takeDraftBudget(store, 3, { creator: "c2" })).toBe(true);
  });

  it("gives the demo the shared budget and a live creator their own", () => {
    expect(budgetFor("demo", "maya")).toBe("demo");
    expect(budgetFor("live", "u1")).toEqual({ creator: "u1" });
  });

  it("fails closed with no store, a zero limit, or a store that errors", async () => {
    expect(await takeDraftBudget(null, 3)).toBe(false);
    expect(await takeDraftBudget(createMemoryStore(), 0)).toBe(false);
    const broken: Store = { ...createMemoryStore(), increment: () => Promise.reject(new Error("down")) };
    expect(await takeDraftBudget(broken, 3)).toBe(false);
  });
});

describe("draftMessage with a budget", () => {
  it("stops calling the model once the budget is spent, and says so", async () => {
    const store = createMemoryStore();
    const generate = vi.fn().mockResolvedValue("A drafted message.");
    const options = { budget: "demo" as const, store, hourlyLimit: 3, model: "m", configured: true, generate };

    for (let i = 0; i < 3; i++) {
      expect((await draftMessage(input, options)).source).toBe("llm");
    }
    const fourth = await draftMessage(input, options);
    expect(fourth.source).toBe("template");
    expect(fourth.warning).toMatch(/paused/);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("reuses a recent draft when a page opens, without spending the budget", async () => {
    const store = createMemoryStore();
    const generate = vi.fn().mockResolvedValue("First draft.");
    const options = { budget: "demo" as const, store, hourlyLimit: 1, model: "m", configured: true, generate };

    expect((await draftMessage(input, options)).text).toBe("First draft.");
    const reopened = await draftMessage(input, { ...options, reuse: true });
    expect(reopened).toEqual({ text: "First draft.", source: "llm" });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("writes a new one when asked for another version", async () => {
    const store = createMemoryStore();
    const generate = vi.fn().mockResolvedValueOnce("First.").mockResolvedValueOnce("Second.");
    const options = { budget: "demo" as const, store, hourlyLimit: 5, model: "m", configured: true, generate };

    await draftMessage(input, options);
    expect((await draftMessage(input, options)).text).toBe("Second.");
  });

  it("never calls the model without a key", async () => {
    const generate = vi.fn();
    const result = await draftMessage(input, { budget: "demo", store: createMemoryStore(), configured: false, generate });
    expect(result.source).toBe("template");
    expect(result.warning).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("a draft that gets the offer wrong", () => {
  it("is replaced by the built-in wording, and the creator is told", async () => {
    const generate = vi.fn().mockResolvedValue("Come back for 40% off!");
    const result = await draftMessage(
      { ...input, approach: "free-week-back", offer: { type: "trial", days: 7 }, endsAt: "2026-10-02T23:59:59.000Z" },
      { budget: "demo", store: createMemoryStore(), hourlyLimit: 3, model: "m", configured: true, generate },
    );
    expect(result.source).toBe("template");
    expect(result.text).toContain("7 days free");
    expect(result.warning).toMatch(/didn't match your offer/);
  });
});

describe("the Upstash store", () => {
  it("counts with INCR and starts the window only once", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: 2 }, { result: 0 }]), { status: 200 }),
    );
    const store = createUpstashStore("https://kv.example/", "token", fetchImpl);
    expect(await store.increment("k", 3600)).toBe(2);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://kv.example/pipeline");
    expect(JSON.parse(init.body)).toEqual([
      ["INCR", "k"],
      ["EXPIRE", "k", 3600, "NX"],
    ]);
    expect(init.headers.Authorization).toBe("Bearer token");
  });

  it("reads a hash back as an object", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: ["a", "1", "b", "2"] }]), { status: 200 }),
    );
    const store = createUpstashStore("https://kv.example", "token", fetchImpl);
    expect(await store.getFields("h")).toEqual({ a: "1", b: "2" });
  });

  it("throws on an error, so callers fail closed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const store = createUpstashStore("https://kv.example", "token", fetchImpl);
    await expect(store.increment("k", 1)).rejects.toThrow();
  });
});

describe("the model call", () => {
  it("never retries, so one draft spent is one call made", async () => {
    vi.resetModules();
    const generateText = vi.fn().mockResolvedValue({ text: "Hi." });
    vi.doMock("ai", () => ({ generateText }));
    vi.doMock("@/env", () => ({ env: { LLM_MODEL: "m", LLM_API_KEY: "k", LLM_HOURLY_LIMIT: 3 } }));
    const { draftMessage: draft } = await import("./draft-message");
    await draft(input, { budget: "demo", store: createMemoryStore() });
    expect(generateText.mock.calls[0]![0]).toMatchObject({ maxRetries: 0 });
    vi.doUnmock("ai");
    vi.doUnmock("@/env");
  });
});
