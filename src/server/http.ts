import { NextResponse } from "next/server";
import { NotConnectedError } from "@/data/get-source";
import { FanvueApiError } from "@/fanvue/client";

type ApiErrorCode =
  | "not_connected"
  | "reconnect_required"
  | "rate_limited"
  | "upstream_error"
  | "bad_request"
  | "already_completed"
  | "not_found"
  | "already_messaged"
  | "already_sending"
  | "offer_gone"
  | "unexpected";

export interface DescribedError {
  code: ApiErrorCode;
  message: string;
  /** What the user can do about it. */
  recovery?: string;
  status: number;
}

export const json = <T,>(body: T, status = 200) => NextResponse.json(body, { status });

export function apiError(code: ApiErrorCode, message: string, status: number, recovery?: string) {
  return json({ error: code, message, ...(recovery && { recovery }) }, status);
}

export function describeError(cause: unknown): DescribedError {
  if (cause instanceof NotConnectedError) {
    return {
      code: "not_connected",
      message: "No Fanvue account is connected.",
      recovery: "Connect your Fanvue account, or try the demo.",
      status: 401,
    };
  }
  if (cause instanceof FanvueApiError) {
    if (cause.needsReconnect) {
      return {
        code: "reconnect_required",
        message: "Fanvue did not accept your access token.",
        recovery: "Disconnect and connect your Fanvue account again.",
        status: 401,
      };
    }
    if (cause.code === "rate_limited") {
      return {
        code: "rate_limited",
        message: "Fanvue is rate limiting this account right now.",
        recovery: "Wait a minute, then try again.",
        status: 429,
      };
    }
    return { code: "upstream_error", message: cause.message, recovery: "Try again in a moment.", status: 502 };
  }

  // A bug rather than a Fanvue answer: keep the detail in the logs, not the browser.
  console.error("Unexpected error", cause);
  return { code: "unexpected", message: "Something went wrong on our side.", recovery: "Try again.", status: 500 };
}

export function errorResponse(cause: unknown) {
  const { code, message, status, recovery } = describeError(cause);
  return apiError(code, message, status, recovery);
}
