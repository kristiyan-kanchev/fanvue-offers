import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws unless the bundler sets the react-server
      // condition, which Vitest does not. The tests import server modules
      // directly, so the guard is stubbed out here.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // src/env.ts validates on import, so give it a valid, throwaway environment.
    // BASE_URL is set explicitly because Vite (which Vitest runs on) also owns
    // that name and would otherwise inject its own value into the workers.
    env: {
      BASE_URL: "http://localhost:3000",
      OAUTH_CLIENT_ID: "test-client-id",
      OAUTH_CLIENT_SECRET: "test-client-secret",
      OAUTH_REDIRECT_URI: "http://localhost:3000/api/oauth/callback",
      OAUTH_SCOPES:
        "read:self read:creator write:creator read:insights read:fan read:chat write:chat",
      SESSION_SECRET: "test-session-secret-value",
      API_BASE_URL: "https://api.fanvue.com",
    },
  },
});
