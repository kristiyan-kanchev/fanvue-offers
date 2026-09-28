// GET /free-trial-links
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { FreeTrialLink } from "@/data/types";

export default {
  "data": []
} satisfies { data: FreeTrialLink[] };
