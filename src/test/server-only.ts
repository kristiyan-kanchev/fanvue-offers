/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * Next.js resolves `server-only` to a module that throws when it is pulled
 * into a client bundle. Vitest has no such condition, and the tests import
 * server modules directly on purpose, so the guard is a no-op here.
 */
export {};
