"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Transition } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ActionKind } from "@/audit/types";
import { LOCALE } from "@/lib/format";
import { ProblemMark } from "./ProblemMark";
import { Spinner } from "./ui";

// A glimpse of the app fixing itself on a loop. Made-up numbers, never a creator's.

type Phase = "todo" | "fixing" | "done";

/** How many people have the problem, and how many the fix brings in. */
type Scene = readonly [problem: number, fixed: number];

const MONTHLY_PRICE = 9.99;

const ROWS: { kind: ActionKind; problem: string; fixed: string; scenes: Scene[] }[] = [
  { kind: "winback", problem: "fans left", fixed: "came back", scenes: [[178, 31], [64, 12], [241, 44]] },
  { kind: "front-door", problem: "never subscribed", fixed: "subscribed", scenes: [[2156, 57], [940, 31], [1480, 44]] },
  { kind: "renewal", problem: "about to leave", fixed: "renewed", scenes: [[358, 96], [120, 38], [205, 61]] },
];

/** How long each phase stays on screen, and what follows it. */
const HOLD_MS: Record<Phase, number> = { todo: 2400, fixing: 1000, done: 2600 };
const NEXT: Record<Phase, Phase> = { todo: "fixing", fixing: "done", done: "todo" };
/** One row fixes itself every two seconds: the cycle split evenly across the rows. */
const STAGGER_MS = (HOLD_MS.todo + HOLD_MS.fixing + HOLD_MS.done) / ROWS.length;

const MONEY: Format = { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 };
const SPRING: Transition = { type: "spring", stiffness: 420, damping: 28 };
const SWAP = { initial: { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.4, opacity: 0 } };

const earnedFrom = ([, fixed]: Scene) => Math.round(fixed * MONTHLY_PRICE);

/**
 * A background tab freezes animations but not timers, so numbers changed while
 * hidden never finish rolling and leave stray digits behind. The loop waits.
 */
function usePageVisible() {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => document.visibilityState === "visible",
    () => true,
  );
}

export function LandingGlimpse() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const still = useReducedMotion();
  const visible = usePageVisible();
  const running = inView && visible && !still;
  const [total, setTotal] = useState(0);
  const earn = useCallback((amount: number) => setTotal((sum) => sum + amount), []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="flex flex-col gap-2.5 rounded-2xl border border-border-primary bg-background-primary/50 p-3 shadow-xl backdrop-blur-xl sm:gap-3 sm:p-8"
    >
      <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1 sm:px-1 sm:pt-0">
        <span className="typography-description-12px-semibold leading-none uppercase tracking-wide text-content-tertiary">
          Brought in this month
        </span>
        <NumberFlow
          value={total}
          format={MONEY}
          locales={LOCALE}
          prefix="+"
          className="text-2xl/none font-semibold tracking-tight text-success-content tabular-nums"
        />
      </div>
      {ROWS.map((row, index) => (
        <GlimpseRow key={row.kind} {...row} delay={index * STAGGER_MS} running={running} onEarned={earn} />
      ))}
    </div>
  );
}

function GlimpseRow({
  kind,
  problem,
  fixed,
  scenes,
  delay,
  running,
  onEarned,
}: (typeof ROWS)[number] & { delay: number; running: boolean; onEarned: (amount: number) => void }) {
  const [{ phase, round }, setStep] = useState<{ phase: Phase; round: number }>({ phase: "todo", round: 0 });
  // Where the loop is, so a pause picks up from there instead of replaying a step.
  const at = useRef({ phase, round, started: false });
  const scene = scenes[round % scenes.length]!;
  const done = phase === "done";

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const phase = NEXT[at.current.phase];
      const round = phase === "todo" ? at.current.round + 1 : at.current.round;
      at.current = { phase, round, started: true };
      setStep({ phase, round });
      if (phase === "done") onEarned(earnedFrom(scenes[round % scenes.length]!));
      timer = setTimeout(advance, HOLD_MS[phase]);
    };
    timer = setTimeout(advance, at.current.started ? HOLD_MS[at.current.phase] : delay);
    return () => clearTimeout(timer);
  }, [running, delay, scenes, onEarned]);

  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border-primary bg-background-primary p-3 pr-4 shadow-sm">
      <motion.span
        className="absolute inset-0 bg-success-surface"
        initial={false}
        animate={{ opacity: done ? 0.5 : 0 }}
        transition={{ duration: 0.5 }}
      />
      <AnimatePresence>
        {phase === "fixing" ? (
          <motion.span
            key="sweep"
            className="absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-content-primary/10 to-transparent"
            initial={{ x: "0%" }}
            animate={{ x: "300%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: HOLD_MS.fixing / 1000, ease: "easeInOut" }}
          />
        ) : null}
      </AnimatePresence>

      <span className="relative grid size-10 shrink-0">
        <AnimatePresence initial={false}>
          <motion.span key={done ? "done" : "todo"} className="col-start-1 row-start-1" {...SWAP} transition={SPRING}>
            {done ? <Tick /> : <ProblemMark kind={kind} />}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="relative flex min-w-0 flex-1 items-baseline gap-1.5 typography-body-small-14px-semibold text-content-primary sm:typography-body-default-16px-semibold">
        <NumberFlow value={done ? scene[1] : scene[0]} locales={LOCALE} className="tabular-nums" />
        <span className="grid min-w-0">
          <AnimatePresence initial={false}>
            <motion.span
              key={done ? fixed : problem}
              className="col-start-1 row-start-1 truncate"
              initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -10, opacity: 0, filter: "blur(4px)" }}
              transition={SPRING}
            >
              {done ? fixed : problem}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>

      <span className="relative grid justify-items-end">
        <AnimatePresence initial={false}>
          {done ? (
            <motion.span
              key="earned"
              className="col-start-1 row-start-1 rounded-full bg-success-surface px-3 py-1 typography-description-12px-semibold text-success-content"
              {...SWAP}
              transition={SPRING}
            >
              <Earned amount={earnedFrom(scene)} />
            </motion.span>
          ) : (
            <motion.span
              key="fix"
              className="col-start-1 row-start-1 flex h-6 min-w-12 items-center justify-center rounded-full bg-content-primary px-3 typography-description-12px-semibold text-background-primary"
              {...SWAP}
              whileTap={{ scale: 0.9 }}
              animate={{ scale: phase === "fixing" ? 0.92 : 1, opacity: 1 }}
              transition={SPRING}
            >
              {phase === "fixing" ? <Spinner /> : "Fix"}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

/** Counts up from nothing once it's on screen. */
function Earned({ amount }: { amount: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(amount));
    return () => cancelAnimationFrame(frame);
  }, [amount]);
  return <NumberFlow value={shown} format={MONEY} locales={LOCALE} prefix="+" suffix="/mo" />;
}

function Tick() {
  return (
    <span className="flex size-10 items-center justify-center rounded-lg bg-success-surface text-success-content">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        />
      </svg>
    </span>
  );
}
