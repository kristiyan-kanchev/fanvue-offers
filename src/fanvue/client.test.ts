import { describe, expect, it, vi } from "vitest";
import { FanvueApiError, createFanvueClient, parseRetryAfter } from "./client";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function clientWith(
  responses: (Response | (() => Response))[],
  extra: Partial<Parameters<typeof createFanvueClient>[0]> = {},
) {
  let index = 0;
  const fetchImpl = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const next = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return typeof next === "function" ? next() : next;
    },
  );
  const sleep = vi.fn(async (_ms: number) => {});
  const client = createFanvueClient({
    accessToken: "token-1",
    baseUrl: "https://api.fanvue.com",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep,
    ...extra,
  });
  return { client, fetchImpl, sleep };
}

function headersOf(call: [string | URL | Request, RequestInit?]): Record<string, string> {
  return (call[1]?.headers ?? {}) as Record<string, string>;
}

describe("the Fanvue client", () => {
  it("pins the API version and sends the bearer token", async () => {
    const { client, fetchImpl } = clientWith([jsonResponse({ uuid: "me" })]);
    await client.get("/users/me");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api.fanvue.com/users/me");
    expect(headersOf(fetchImpl.mock.calls[0])["X-Fanvue-API-Version"]).toBe("2025-06-26");
    expect(headersOf(fetchImpl.mock.calls[0]).Authorization).toBe("Bearer token-1");
    expect(init?.method).toBe("GET");
  });

  it("serialises query parameters and skips undefined ones", async () => {
    const { client, fetchImpl } = clientWith([jsonResponse({})]);
    await client.get("/insights/fan-retention-summary", {
      query: { periods: 8, startDate: undefined },
    });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("periods=8");
    expect(url).not.toContain("startDate");
  });

  it("waits for Retry-After, retries once, then returns the result", async () => {
    const { client, fetchImpl, sleep } = clientWith([
      jsonResponse({ message: "slow down" }, 429, { "Retry-After": "2" }),
      jsonResponse({ data: [] }),
    ]);

    await expect(client.get("/promotions")).resolves.toEqual({ data: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("surfaces a rate limit once the retry budget is spent", async () => {
    const { client, fetchImpl } = clientWith([
      jsonResponse({}, 429, { "Retry-After": "1" }),
      jsonResponse({}, 429, { "Retry-After": "1" }),
    ]);

    const error = await client.get("/promotions").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FanvueApiError);
    expect((error as FanvueApiError).code).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refreshes once on a 401 and retries with the new token", async () => {
    const refresh = vi.fn(async () => "token-2");
    const { client, fetchImpl } = clientWith(
      [jsonResponse({ message: "expired" }, 401), jsonResponse({ uuid: "me" })],
      { refreshAccessToken: refresh },
    );

    await expect(client.get("/users/me")).resolves.toEqual({ uuid: "me" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchImpl.mock.calls[1]).Authorization).toBe("Bearer token-2");
  });

  it("gives up when the refresh itself fails", async () => {
    const refresh = vi.fn(async () => null);
    const { client, fetchImpl } = clientWith([jsonResponse({}, 401)], {
      refreshAccessToken: refresh,
    });

    const error = await client.get("/users/me").catch((e: unknown) => e);
    expect((error as FanvueApiError).code).toBe("unauthorized");
    expect((error as FanvueApiError).needsReconnect).toBe(true);
    // One attempt only: no loop when there is nothing to refresh with.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a network failure as a typed error", async () => {
    const { client } = clientWith([
      () => {
        throw new Error("socket hang up");
      },
    ]);
    const error = await client.get("/users/me").catch((e: unknown) => e);
    expect((error as FanvueApiError).code).toBe("network");
    expect((error as FanvueApiError).message).toContain("socket hang up");
  });

  it("reads an HTTP-date Retry-After", () => {
    const now = Date.parse("2026-09-23T10:00:00Z");
    expect(parseRetryAfter("Wed, 23 Sep 2026 10:00:30 GMT", now)).toBe(30);
    expect(parseRetryAfter("5", now)).toBe(5);
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter("nonsense", now)).toBeUndefined();
  });
});

describe("a request Fanvue doesn't answer", () => {
  it("gives up after the timeout with a plain message", async () => {
    const { createFanvueClient } = await import("./client");
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    const client = createFanvueClient({ accessToken: "t", baseUrl: "https://api.test", fetchImpl: hang, timeoutMs: 20 });
    await expect(client.get("/promotions")).rejects.toMatchObject({ code: "network", message: "Fanvue didn't answer in time." });
  });
});
