// GET /promotions
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { Promotion } from "@/data/types";

export default {
  // Maya has no live promotion: no front door for new fans, and no offer for the
  // 178 lapsed subscribers. That is what makes attraction and downsell fire.
  "data": []
} satisfies { data: Promotion[] };
