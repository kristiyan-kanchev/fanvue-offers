import { z } from "zod";

// The fields the rules read from each Fanvue response, checked at run time: the
// generated types say what Fanvue promises, these catch the day it sends
// something else. Extra fields pass through.

const nullableString = z.string().nullable();
const count = z.number().finite();

export const SmartListsShape = z.array(z.looseObject({ uuid: z.string(), count }));

export const PromotionsShape = z.looseObject({
  data: z.array(
    z.looseObject({
      uuid: z.string(),
      type: z.string(),
      availableToGroup: z.string(),
      usedCount: count,
      maxUsages: count.nullable().optional(),
      endsAt: nullableString.optional(),
      freeTrialDays: count.nullable().optional(),
      createdAt: z.string(),
    }),
  ),
});

export const FreeTrialLinksShape = z.looseObject({
  data: z.array(
    z.looseObject({
      usedCount: count,
      maxUsages: count.nullable().optional(),
      expiresAt: nullableString.optional(),
      trialDurationDays: count.nullable().optional(),
      createdAt: z.string(),
    }),
  ),
});

export const RetentionShape = z.looseObject({
  snapshots: z.array(
    z.looseObject({
      periodStart: z.string(),
      paidFanChurnRate: count,
      paidReactivatedFansCount: count,
      revenueLost: count,
    }),
  ),
});

export const UnsubscribeReasonsShape = z.looseObject({
  rollingTotal: count,
  reasons: z.array(z.looseObject({ reason: z.string(), rollingCount: count })),
});

export const AutomatedMessagesShape = z.looseObject({
  data: z.array(z.looseObject({ trigger: z.string(), enabled: z.boolean() })),
});

export const MassMessagesShape = z.looseObject({
  data: z.array(
    z.looseObject({
      uuid: z.string(),
      status: z.string(),
      recipientCount: count,
      createdAt: z.string(),
    }),
  ),
});

export const AccountShape = z.looseObject({
  account: z.looseObject({ subscriptionPrice: count.nullable().optional() }),
});

export function checked<T>(shape: z.ZodType, value: T): T {
  const result = shape.safeParse(value);
  if (result.success) return value;
  const path = result.error.issues[0]?.path.join(".");
  throw new Error(`it came back in a shape we didn't expect${path ? ` at ${path}` : ""}`);
}
