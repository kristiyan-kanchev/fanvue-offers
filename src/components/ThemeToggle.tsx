"use client";

import { useState } from "react";
import { IconButton, MoonIcon, SunIcon } from "@fanvue/ui";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";

/** Flips the class for this page and saves the choice, so the server renders it from now on. */
export function ThemeToggle({ theme: initial }: { theme: Theme }) {
  const [theme, setTheme] = useState(initial);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    document.documentElement.classList.replace(theme, next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
    setTheme(next);
  }

  return (
    <IconButton
      variant="tertiary"
      size="32"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      icon={dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
      onClick={toggle}
    />
  );
}
