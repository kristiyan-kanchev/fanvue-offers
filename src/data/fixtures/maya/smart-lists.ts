// GET /chats/lists/smart
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { SmartList } from "@/data/types";

export default [
  {
    "name": "Subscribers",
    "uuid": "subscribers",
    "count": 1250
  },
  {
    "name": "Auto-renewing",
    "uuid": "auto_renewing",
    "count": 892
  },
  {
    "name": "Non-renewing",
    "uuid": "non_renewing",
    "count": 358
  },
  {
    "name": "Followers",
    "uuid": "followers",
    "count": 2156
  },
  {
    "name": "Free trial subscribers",
    "uuid": "free_trial_subscribers",
    "count": 0
  },
  {
    "name": "Expired subscribers",
    "uuid": "expired_subscribers",
    "count": 178
  },
  {
    "name": "Spent more than $50",
    "uuid": "spent_more_than_50",
    "count": 423
  },
  {
    "name": "Muted",
    "uuid": "muted",
    "count": 61
  },
  {
    "name": "Creators",
    "uuid": "creators",
    "count": 44
  }
] satisfies SmartList[];
