// GET /chats/mass-messages?size=50
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { MassMessage } from "@/data/types";

/**
 * Maya's recent broadcasts, both more than a week old, so no list is resting.
 * The source keeps only the counts and list names; the text is here because the API returns it.
 */
export default {
  "data": [
    {
      "uuid": "5e8a1c3f-94b2-4d07-a6e1-2f7c9b0d4e18",
      "text": "The 4-week mobility block is ready. Twenty minutes a day, built for the stiffness heavy training leaves behind.",
      "status": "SENT",
      "price": 1200,
      "createdAt": "2026-09-09",
      "publishedAt": "2026-09-09",
      "scheduledAt": null,
      "recipientCount": 1238,
      "viewCount": 702,
      "purchaseCount": 61,
      "totalRevenue": 73200,
      "mediaUuids": ["a3d5f7e9-1b2c-4d6e-8f0a-2c4e6a8b0d13"],
      "includedLists": { "smartListIds": ["subscribers"], "smartListUuids": ["subscribers"], "customListUuids": [] },
      "excludedLists": { "smartListIds": [], "smartListUuids": [], "customListUuids": [] }
    },
    {
      "uuid": "c0f2a4b6-8d1e-4f3a-b5c7-9e1d3f5a7b24",
      "text": "Deload week. Here is the full plan and why it matters.",
      "status": "SENT",
      "price": null,
      "createdAt": "2026-08-26",
      "publishedAt": "2026-08-26",
      "scheduledAt": null,
      "recipientCount": 1301,
      "viewCount": 944,
      "purchaseCount": 0,
      "totalRevenue": 0,
      "mediaUuids": [],
      "includedLists": { "smartListIds": ["subscribers"], "smartListUuids": ["subscribers"], "customListUuids": [] },
      "excludedLists": { "smartListIds": [], "smartListUuids": [], "customListUuids": [] }
    }
  ],
  "pagination": { "page": 1, "size": 2, "hasMore": false }
} satisfies { data: MassMessage[]; pagination: { page: number; size: number; hasMore: boolean } };
