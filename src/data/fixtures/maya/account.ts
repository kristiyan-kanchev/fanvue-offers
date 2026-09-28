// GET /users/account
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { FanvueAccount } from "@/data/types";

export default {
  "uuid": "8f14e45f-ceea-4a1e-9c1b-2f0a7d3b6e10",
  "email": "maya@coachmaya.example",
  "handle": "coachmaya",
  "displayName": "Coach Maya",
  "isCreator": true,
  "isAiCreator": false,
  "createdAt": "2024-03-11T09:14:00Z",
  "updatedAt": "2026-09-20T16:02:00Z",
  "avatarUrl": null,
  "bannerUrl": null,
  "bio": "Strength and conditioning coach. 12-week programmes, meal plans, and weekly form checks.",
  "likesCount": 18422,
  "contentCounts": {
    "imageCount": 812,
    "videoCount": 236,
    "audioCount": 0,
    "postCount": 640,
    "payToViewPostCount": 118
  },
  "account": {
    "status": "active",
    // US$9.99 a month. Matches the retention fixture, where weekly subscription
    // revenue over paid fans comes to about 230 cents a head.
    "subscriptionPrice": 999,
    "earnings": {
      "total": 12400000,
      "availableBalance": 684000,
      "lastPayoutAt": "2026-09-15T08:00:00Z"
    },
    "fans": {
      "followers": 2156,
      "subscribers": 1250
    }
  }
} satisfies FanvueAccount;
