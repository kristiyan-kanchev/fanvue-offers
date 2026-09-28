import { createHash } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { CreatorSnapshot } from "@/data/types";
import { env } from "@/env";
import { getStore, type Store } from "@/lib/store";
import { PLACEHOLDER } from "./approaches";
import { BUDGET_WINDOW_SECONDS, takeDraftBudget, type DraftBudget } from "./draft-budget";
import { MAX_DRAFT_CHARS, systemPrompt, templateDraft, userPrompt, type DraftInput } from "./draft-copy";
import { messageProblem } from "./message-check";

export interface DraftResult {
  text: string;
  source: "llm" | "template";
  /** Why the built-in wording was used instead of an AI draft. */
  warning?: string;
}

interface DraftOptions {
  budget: DraftBudget;
  /** Show a recent draft of the same message instead of writing a new one: true when a page opens. */
  reuse?: boolean;
  store?: Store | null;
  hourlyLimit?: number;
  model?: string;
  configured?: boolean;
  generate?: (system: string, prompt: string) => Promise<string>;
}

const PAUSED = "AI drafts are paused for a little while, so this is the built-in wording. You can still edit it.";
const UNAVAILABLE = "AI drafting didn't work just now, so this is the built-in wording.";
const WRONG_OFFER = "The AI draft didn't match your offer, so this is the built-in wording.";

async function callModel(system: string, prompt: string): Promise<string> {
  const provider = createOpenAI({ apiKey: env.LLM_API_KEY, baseURL: env.LLM_BASE_URL });
  const { text } = await generateText({
    // chat(), not the default Responses API, which OpenRouter doesn't implement.
    model: provider.chat(env.LLM_MODEL!),
    system,
    prompt,
    maxOutputTokens: 400,
    temperature: 0.7,
    // One draft spent is one call made.
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(20_000),
  });
  return text;
}

/** Trims to the character limit, at the end of a sentence where there's one past halfway. */
function clampDraft(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_DRAFT_CHARS) return trimmed;
  const cut = trimmed.slice(0, MAX_DRAFT_CHARS);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > MAX_DRAFT_CHARS / 2 ? cut.slice(0, lastStop + 1) : cut).trim();
}

/**
 * The model writes the copy and nothing else: the numbers come from the plan.
 * Every call spends from an hourly budget; past it, or if anything goes wrong,
 * the built-in wording is used.
 */
export async function draftMessage(input: DraftInput, options: DraftOptions): Promise<DraftResult> {
  const {
    budget,
    reuse = false,
    store = getStore(),
    hourlyLimit = env.LLM_HOURLY_LIMIT,
    model = env.LLM_MODEL ?? "",
    configured = Boolean(env.LLM_MODEL && env.LLM_API_KEY),
    generate = callModel,
  } = options;
  const fallback = (warning?: string): DraftResult => ({ text: templateDraft(input), source: "template", warning });

  if (!configured) return fallback();

  const system = systemPrompt(input.approach);
  const prompt = userPrompt(input);
  const cacheKey = `drafts:${createHash("sha256").update(`${model}\n${system}\n${prompt}`).digest("hex")}`;

  if (reuse) {
    const cached = await store?.get(cacheKey).catch(() => null);
    if (cached) return { text: cached, source: "llm" };
  }

  if (!(await takeDraftBudget(store, hourlyLimit, budget))) return fallback(PAUSED);

  let text: string;
  try {
    text = clampDraft(await generate(system, prompt));
  } catch {
    return fallback(UNAVAILABLE);
  }
  if (!text) return fallback(UNAVAILABLE);
  // Some approaches ask for a [gap]; anything else the offer doesn't give is never shown.
  if (!PLACEHOLDER.test(text) && messageProblem(input.offer, text)) return fallback(WRONG_OFFER);

  await store?.set(cacheKey, text, BUDGET_WINDOW_SECONDS).catch(() => undefined);
  return { text, source: "llm" };
}

/** The creator's name, bio and recent writing, which a draft is written to sound like. */
export function creatorVoice(snapshot: CreatorSnapshot): Pick<DraftInput, "creatorName" | "bio" | "voiceSamples"> {
  const { displayName, bio, voiceSamples } = snapshot.creator;
  return { creatorName: displayName, ...(bio && { bio }), voiceSamples };
}

export function draftWelcome(snapshot: CreatorSnapshot, options: DraftOptions): Promise<DraftResult> {
  return draftMessage(
    { approach: "welcome", ...creatorVoice(snapshot), recipientCount: 0, offer: null, endsAt: null },
    options,
  );
}
