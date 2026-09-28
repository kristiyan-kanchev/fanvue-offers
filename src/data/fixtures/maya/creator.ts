// GET /users/me
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { FanvueUser } from "@/data/types";

export default {
  "uuid": "8f14e45f-ceea-4a1e-9c1b-2f0a7d3b6e10",
  "email": "maya@coachmaya.example",
  "handle": "coachmaya",
  "bio": "Strength and conditioning coach. 12-week programmes, meal plans, and weekly form checks.",
  "displayName": "Coach Maya",
  "isCreator": true,
  "isAiCreator": false,
  "roles": [
    "creator"
  ],
  "isDiscoverable": true,
  "isInCuratedSection": false,
  "createdAt": "2024-03-11T09:14:00Z",
  "updatedAt": "2026-09-20T16:02:00Z",
  "avatarUrl": null,
  "bannerUrl": null,
  "likesCount": 18422,
  "fanCounts": {
    "followersCount": 2156,
    "subscribersCount": 1250
  },
  "contentCounts": {
    "imageCount": 812,
    "videoCount": 236,
    "audioCount": 0,
    "postCount": 640,
    "payToViewPostCount": 118
  }
} satisfies FanvueUser;
