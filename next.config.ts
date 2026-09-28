import type { NextConfig } from "next";
import { COLOR_SCHEME_HINT } from "./src/lib/theme";

/**
 * Sent with every response in production. The policy is as tight as the app
 * allows without per-request nonces: Next.js needs inline scripts, and the
 * only outside sources are profile pictures and covers from Fanvue's image hosts. Development is left alone, since Next's hot reload
 * needs eval.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** Asks Chromium for the device's colour scheme, so a first visit renders in it. */
const THEME_HINT_HEADERS = [
  { key: "Accept-CH", value: COLOR_SCHEME_HINT },
  { key: "Critical-CH", value: COLOR_SCHEME_HINT },
  { key: "Vary", value: COLOR_SCHEME_HINT },
];

const nextConfig: NextConfig = {
  // Development only: Next refuses to serve its dev resources to a host it
  // does not recognise, which silently breaks hydration. Anything other than
  // localhost has to be listed here. Ignored in production builds.
  allowedDevOrigins: ["127.0.0.1", "*.local"],
  poweredByHeader: false,
  // History is part of the overview now.
  async redirects() {
    return [{ source: "/history", destination: "/audit", permanent: true }];
  },
  async headers() {
    const production = process.env.NODE_ENV === "production";
    return [{ source: "/:path*", headers: [...THEME_HINT_HEADERS, ...(production ? SECURITY_HEADERS : [])] }];
  },
};

export default nextConfig;
