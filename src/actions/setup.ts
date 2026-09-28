import "server-only";

import { z } from "zod";
import type { DemoSetup } from "@/data/types";
import type { FanvueClient } from "@/fanvue/client";
import { patchJson, postJson, putJson } from "@/fanvue/typed";
import { PLACEHOLDER } from "./approaches";

// Fanvue's own limits, checked before the call is made.
const PRICE_CENTS = { min: 399, max: 10_000 };

export const SETUP_REQUEST = z.discriminatedUnion("step", [
  z.object({ step: z.literal("price"), cents: z.number().int().min(PRICE_CENTS.min).max(PRICE_CENTS.max) }),
  z.object({
    step: z.literal("welcome"),
    text: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .refine((text) => !PLACEHOLDER.test(text), "Fill in the part in [brackets] first."),
  }),
  z.object({ step: z.literal("trial-link"), days: z.number().int().min(1).max(30) }),
]);

type SetupRequest = z.infer<typeof SETUP_REQUEST>;

/** The real Fanvue call. Returns the trial link's URL when there is one. */
export async function runSetupStep(client: FanvueClient, request: SetupRequest): Promise<{ url?: string }> {
  switch (request.step) {
    case "price":
      await patchJson(client, "/users/me/subscription-price", { subscriptionPrice: request.cents });
      return {};
    case "welcome":
      await putJson(client, "/chats/automated-messages/{trigger}", { trigger: "new_subscriber" }, { text: request.text });
      return {};
    case "trial-link": {
      const link = await postJson(client, "/free-trial-links", { name: "Offers", trialDurationDays: request.days });
      return link.url ? { url: link.url } : {};
    }
  }
}

/** What the demo remembers instead, so its dashboard shows the step as done. */
export function demoSetupFor(request: SetupRequest): DemoSetup {
  switch (request.step) {
    case "price":
      return { price: request.cents };
    case "welcome":
      return { welcome: request.text };
    case "trial-link":
      return { trialDays: request.days };
  }
}
