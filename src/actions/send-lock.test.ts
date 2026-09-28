import { describe, expect, it, vi } from "vitest";
import { createMemoryStore, createUpstashStore, type Store } from "@/lib/store";
import { claimSend, SEND_LOCK_SECONDS } from "./send-lock";

describe("the send lock", () => {
  it("lets one send through per creator and list, and turns the second away", async () => {
    const store = createMemoryStore();
    const [a, b] = await Promise.all([claimSend(store, "c1", "winback"), claimSend(store, "c1", "winback")]);
    expect([a.held, b.held].sort()).toEqual([false, true]);
  });

  it("doesn't block a different list, or a different creator", async () => {
    const store = createMemoryStore();
    await claimSend(store, "c1", "winback");
    expect((await claimSend(store, "c1", "renewal")).held).toBe(true);
    expect((await claimSend(store, "c2", "winback")).held).toBe(true);
  });

  it("is released after a failure, so the creator can try again", async () => {
    const store = createMemoryStore();
    const first = await claimSend(store, "c1", "winback");
    if (first.held) await first.release();
    expect((await claimSend(store, "c1", "winback")).held).toBe(true);
  });

  it("expires on its own after a success", async () => {
    let t = 0;
    const store = createMemoryStore(() => t);
    await claimSend(store, "c1", "winback");
    t = SEND_LOCK_SECONDS * 1000;
    expect((await claimSend(store, "c1", "winback")).held).toBe(true);
  });

  it("lets the send go ahead on the weekly check alone when the store is missing or down", async () => {
    expect((await claimSend(null, "c1", "winback")).held).toBe(true);
    const down: Store = { ...createMemoryStore(), claim: () => Promise.reject(new Error("down")) };
    expect((await claimSend(down, "c1", "winback")).held).toBe(true);
  });

  it("claims with SET NX EX on Upstash", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: null }]), { status: 200 }));
    const store = createUpstashStore("https://kv.example", "t", fetchImpl);
    expect(await store.claim("k", 300)).toBe(false);
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toEqual([["SET", "k", "1", "NX", "EX", 300]]);
  });
});
