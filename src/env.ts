import "server-only";

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    OAUTH_CLIENT_ID: z.string().min(1),
    OAUTH_CLIENT_SECRET: z.string().min(1),
    OAUTH_ISSUER_BASE_URL: z.url().default("https://auth.fanvue.com"),
    OAUTH_REDIRECT_URI: z.url(),
    OAUTH_SCOPES: z.string(),
    BASE_URL: z.url(),
    SESSION_COOKIE_NAME: z.string().default("fanvue_oauth"),
    SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
    API_BASE_URL: z.url().default("https://api.fanvue.com"),

    // Optional: without a model, drafts use the built-in wording.
    LLM_MODEL: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    LLM_BASE_URL: z.url().optional(),
    LLM_HOURLY_LIMIT: z.coerce.number().int().min(0).default(3),

    // Upstash Redis. Vercel's integration sets the KV_* names; upstash.com gives the UPSTASH_* ones.
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
});
