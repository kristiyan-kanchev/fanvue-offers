"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { useSyncExternalStore } from "react";
import type { Theme } from "@/lib/theme";

const MESH_COLORS = {
  dark: ["#0a0a0c", "#15472a", "#34207a", "#0a0a0c", "#1f5a2c"],
  light: ["#ffffff", "#bff5c8", "#d8ccff", "#f6f4ff", "#dcfae1"],
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * A slow mesh gradient in Fanvue's green and purple, under a faint dot grid.
 * Safari 26 colours its toolbars from a fixed element at the screen's edge,
 * not from a canvas: the near-transparent fill lets it show the page through
 * them, and the gradient fades into the page colour at both edges, so a
 * solid toolbar still matches.
 */
export function LandingBackdrop({ theme }: { theme: Theme }) {
  const dark = theme === "dark";
  const still = usePrefersReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh overflow-hidden bg-background-primary/1">
      <MeshGradient
        className="absolute inset-0 size-full"
        colors={dark ? MESH_COLORS.dark : MESH_COLORS.light}
        distortion={0.85}
        swirl={0.35}
        grainMixer={0}
        grainOverlay={dark ? 0.12 : 0.06}
        speed={still ? 0 : 0.25}
      />
      <div className="dot-grid" />
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background-primary" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background-primary" />
    </div>
  );
}

/** A light that travels round the edge of whatever it wraps. */
export function GlowPanel({ children }: { children: React.ReactNode }) {
  return <div className="border-beam">{children}</div>;
}
