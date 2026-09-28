// Safe to import from the browser: nothing here reads the environment.

export const FANVUE_API_VERSION = "2025-06-26";

/** Shown on the connect screen. App Store rule 1.5 asks for a plain account of what's accessed. */
export const ACCESS_SUMMARY = [
  "Reads your subscriber counts, promotions, retention and exit survey reasons.",
  "Creates a promotion or sends a message only when you approve that one.",
  "Never reads your chats. From your mass messages it reads the counts, which lists they went to, and the text of your last three, so drafts sound like you. Nothing is stored.",
] as const;

export const FANVUE_APP_STORE_URL = "https://www.fanvue.com/apps";
