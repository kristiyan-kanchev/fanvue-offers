// Fanvue's tokens switch on a `dark` class on <html>. The server renders it from
// this cookie, so it's right on first paint and survives every re-render.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The browser's own colour-scheme hint, sent on request by Chromium. */
export const COLOR_SCHEME_HINT = "Sec-CH-Prefers-Color-Scheme";

export const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark";
