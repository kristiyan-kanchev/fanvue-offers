// GET /chats/automated-messages
// Shape is checked against src/fanvue/schema.d.ts: a mismatch fails tsc.
import type { AutomatedMessage } from "@/data/types";

export default {
  "data": [
    {
      "trigger": "new_subscriber",
      "enabled": true,
      "text": "Welcome in. Start with the Week 1 foundations session, then message me your numbers.",
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": "2026-05-02T11:20:00Z"
    },
    {
      "trigger": "new_follower",
      "enabled": true,
      "text": "Thanks for following. The free trial link in my bio is the fastest way to try a programme.",
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": "2026-05-02T11:22:00Z"
    },
    {
      "trigger": "subscription_canceled",
      "enabled": false,
      "text": null,
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": null
    },
    {
      "trigger": "re_subscribed",
      "enabled": false,
      "text": null,
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": null
    },
    {
      "trigger": "renewed",
      "enabled": false,
      "text": null,
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": null
    },
    {
      "trigger": "new_purchase",
      "enabled": false,
      "text": null,
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": null
    },
    {
      "trigger": "first_message_reply",
      "enabled": true,
      "text": "Thanks for the message. I answer every one within a few hours.",
      "price": null,
      "mediaUuids": [],
      "mediaPreviewUuid": null,
      "updatedAt": "2026-06-18T08:45:00Z"
    }
  ]
} satisfies { data: AutomatedMessage[] };
