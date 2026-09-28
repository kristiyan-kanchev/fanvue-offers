// GET /insights/unsubscribe-reasons
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { UnsubscribeReasons } from "@/data/types";

export default {
  "reasons": [
    {
      "reason": "too_expensive",
      "currentWeekCount": 29,
      "rollingCount": 214
    },
    {
      "reason": "not_enough_content",
      "currentWeekCount": 14,
      "rollingCount": 131
    },
    {
      "reason": "creator_not_active",
      "currentWeekCount": 9,
      "rollingCount": 88
    },
    {
      "reason": "content_not_expected",
      "currentWeekCount": 6,
      "rollingCount": 61
    },
    {
      "reason": "other",
      "currentWeekCount": 4,
      "rollingCount": 27
    }
  ],
  "currentWeekTotal": 62,
  "rollingTotal": 521
} satisfies UnsubscribeReasons;
