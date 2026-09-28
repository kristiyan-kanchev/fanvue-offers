import { env } from "@/env";
import { FANVUE_API_VERSION } from "./constants";

type FanvueErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "rate_limited"
  | "server_error"
  | "network";

export class FanvueApiError extends Error {
  readonly status: number;
  readonly code: FanvueErrorCode;
  readonly body: unknown;

  constructor({ status, message, body }: { status: number; message: string; body?: unknown }) {
    super(message);
    this.name = "FanvueApiError";
    this.status = status;
    this.code = codeForStatus(status);
    this.body = body;
  }

  /** The only fix is for the creator to connect again. */
  get needsReconnect(): boolean {
    return this.code === "unauthorized";
  }
}

function codeForStatus(status: number): FanvueErrorCode {
  if (status === 0) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "bad_request";
}

/** `Retry-After` is either seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - now) / 1000);
}

export interface RequestOptions {
  /** An array is sent as a repeated key, which is how Fanvue reads array parameters. */
  query?: Record<string, string | number | boolean | readonly (string | number)[] | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

type Method = "GET" | "POST" | "PUT" | "PATCH";

export type FanvueClient = Record<Lowercase<Method>, <T>(path: string, options?: RequestOptions) => Promise<T>>;

interface ClientOptions {
  accessToken: string;
  /** Called at most once per request, on a 401. Null means the refresh failed too. */
  refreshAccessToken?: () => Promise<string | null>;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const MAX_RETRY_WAIT_SECONDS = 10;

export function createFanvueClient({
  accessToken,
  refreshAccessToken,
  baseUrl = env.API_BASE_URL,
  timeoutMs = 15_000,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
}: ClientOptions): FanvueClient {
  let token = accessToken;

  function send(method: Method, path: string, { query, body, headers }: RequestOptions): Promise<Response> {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      for (const item of [value].flat()) if (item !== undefined) url.searchParams.append(key, String(item));
    }
    return fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Fanvue-API-Version": FANVUE_API_VERSION,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    let retriedRateLimit = false;
    let refreshed = false;

    for (;;) {
      let res: Response;
      try {
        res = await send(method, path, options);
      } catch (cause) {
        const timedOut = (cause as Error).name === "TimeoutError";
        throw new FanvueApiError({
          status: 0,
          message: timedOut ? "Fanvue didn't answer in time." : `Could not reach Fanvue: ${(cause as Error).message}`,
          body: cause,
        });
      }

      if (res.ok) {
        const text = await res.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }

      // One retry for each: a 429 after Fanvue's own wait, a 401 after a token refresh.
      if (res.status === 429 && !retriedRateLimit) {
        retriedRateLimit = true;
        const wait = parseRetryAfter(res.headers.get("Retry-After"), now()) ?? 1;
        await sleep(Math.min(wait, MAX_RETRY_WAIT_SECONDS) * 1000);
        continue;
      }
      if (res.status === 401 && !refreshed && refreshAccessToken) {
        refreshed = true;
        const next = await refreshAccessToken();
        if (next) {
          token = next;
          continue;
        }
      }

      const body = await res.json().catch(() => undefined);
      throw new FanvueApiError({ status: res.status, message: errorMessage(method, path, res.status, body), body });
    }
  }

  return {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    patch: (path, options) => request("PATCH", path, options),
  };
}

function errorMessage(method: string, path: string, status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const { message, error, detail } = body as Record<string, unknown>;
    const text = [message, error, detail].find((value) => typeof value === "string" && value.length > 0);
    if (text) return text as string;
  }
  return `${method} ${path} failed with ${status}`;
}
