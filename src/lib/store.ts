import "server-only";

import { env } from "@/env";

/**
 * Shared state for the drafting budget, the send lock and History: Upstash
 * Redis over REST, so every server instance sees the same counts, or an
 * in-memory map for local development. Nothing about a fan is written here.
 */
export interface Store {
  /** Adds one to a counter and returns the new value. The counter expires `ttlSeconds` after it was created. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Sets the key only if it isn't already set. True when this call set it: a lock. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  remove(key: string): Promise<void>;
  /** Sets one field of a hash. */
  setField(key: string, field: string, value: string): Promise<void>;
  /** Every field of a hash, or an empty object. */
  getFields(key: string): Promise<Record<string, string>>;
}

export function createMemoryStore(now: () => number = Date.now): Store {
  const values = new Map<string, { value: string; expiresAt: number | null }>();
  const hashes = new Map<string, Map<string, string>>();

  function live(key: string) {
    const entry = values.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) {
      values.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    async increment(key, ttlSeconds) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      values.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? now() + ttlSeconds * 1000 });
      return next;
    },
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttlSeconds) {
      values.set(key, { value, expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : null });
    },
    async claim(key, ttlSeconds) {
      if (live(key)) return false;
      values.set(key, { value: "1", expiresAt: now() + ttlSeconds * 1000 });
      return true;
    },
    async remove(key) {
      values.delete(key);
    },
    async setField(key, field, value) {
      const hash = hashes.get(key) ?? new Map<string, string>();
      hash.set(field, value);
      hashes.set(key, hash);
    },
    async getFields(key) {
      return Object.fromEntries(hashes.get(key) ?? []);
    },
  };
}

type Command = (string | number)[];

/** Upstash's REST API: one command, or a pipeline of several, as JSON arrays. */
export function createUpstashStore(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Store {
  async function pipeline(commands: Command[]): Promise<unknown[]> {
    const res = await fetchImpl(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Store request failed (${res.status})`);
    const body = (await res.json()) as { result?: unknown; error?: string }[];
    return body.map((item) => {
      if (item.error) throw new Error(`Store error: ${item.error}`);
      return item.result;
    });
  }

  return {
    async increment(key, ttlSeconds) {
      // NX: the window starts at the first increment and is never extended.
      const [count] = await pipeline([
        ["INCR", key],
        ["EXPIRE", key, ttlSeconds, "NX"],
      ]);
      return Number(count);
    },
    async get(key) {
      const [value] = await pipeline([["GET", key]]);
      return typeof value === "string" ? value : null;
    },
    async set(key, value, ttlSeconds) {
      await pipeline([ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]]);
    },
    async claim(key, ttlSeconds) {
      const [result] = await pipeline([["SET", key, "1", "NX", "EX", ttlSeconds]]);
      return result === "OK";
    },
    async remove(key) {
      await pipeline([["DEL", key]]);
    },
    async setField(key, field, value) {
      await pipeline([["HSET", key, field, value]]);
    },
    async getFields(key) {
      const [flat] = await pipeline([["HGETALL", key]]);
      const out: Record<string, string> = {};
      if (Array.isArray(flat)) {
        for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
      }
      return out;
    },
  };
}

let shared: Store | null | undefined;

/**
 * Null in production without Upstash: a per-instance map would give every
 * server its own budget, so callers treat no store as no budget.
 */
export function getStore(): Store | null {
  if (shared !== undefined) return shared;
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) shared = createUpstashStore(url, token);
  else shared = process.env.NODE_ENV === "production" ? null : createMemoryStore();
  return shared;
}
