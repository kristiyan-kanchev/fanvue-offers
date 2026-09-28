import "server-only";
import { cookies, headers } from "next/headers";
import { COLOR_SCHEME_HINT, isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** The creator's choice, else what their device asks for, else dark. */
export async function getTheme(): Promise<Theme> {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  if (isTheme(saved)) return saved;
  return (await headers()).get(COLOR_SCHEME_HINT)?.includes("light") ? "light" : "dark";
}
