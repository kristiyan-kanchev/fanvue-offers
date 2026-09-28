import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { getTheme } from "@/server/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Offers",
  description:
    "See where you're losing money on Fanvue, and fix it in two minutes.",
};

// Draw under the phone's safe areas too, so the backdrop reaches the screen's edges.
export const viewport: Viewport = { viewportFit: "cover" };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, theme] = await Promise.all([getSession(), getTheme()]);

  return (
    <html lang="en" className={`${inter.variable} ${theme} bg-background-primary`}>
      <body className="text-content-primary antialiased">
        <AppShell mode={session?.mode ?? null} demoPersona={session?.demoCreator ?? null} theme={theme}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
