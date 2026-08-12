import { z } from "zod";
import { expenseIconKeys } from "./expense-icons";

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter ISO 4217 currency code");

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

export const groupIconKeys = [
  "default",
  "trip",
  "home",
  "food",
  "drinks",
  "party",
  "beach",
  "outdoors",
  "car",
  "sports",
  "music",
  "gift",
  "work",
  "study",
  "shopping",
  "event",
] as const;

export const groupIconKeySchema = z.enum(groupIconKeys);

export type GroupIconKey = z.infer<typeof groupIconKeySchema>;

export const groupColorPresets = [
  "#4745B8",
  "#1764B0",
  "#00749A",
  "#087867",
  "#237A43",
  "#5D761E",
  "#8A6500",
  "#A65300",
  "#B0442D",
  "#B7373C",
  "#A93668",
  "#923F83",
  "#7142AE",
  "#5E4DB3",
  "#7A5634",
  "#526675",
] as const;

export const groupColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hexadecimal color")
  .transform((value) => value.toUpperCase());

export type GroupColor = z.infer<typeof groupColorSchema>;

export const customImageDataUrlSchema = z
  .string()
  .max(700_000, "Image is too large")
  .regex(
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Use a JPEG image",
  );

export type CustomImageDataUrl = z.infer<typeof customImageDataUrlSchema>;

export const expenseIconKeySchema = z.enum(expenseIconKeys);

export const moneySchema = z.object({
  currency: currencyCodeSchema,
  minor: z.string().regex(/^-?\d+$/),
});

export type Money = z.infer<typeof moneySchema>;

export const rateSnapshotSchema = z.object({
  base: currencyCodeSchema,
  quote: currencyCodeSchema,
  rate: z.string().regex(/^\d+(?:\.\d+)?$/),
  provider: z.string().min(1),
  providerDate: z.iso.date(),
  source: z.enum(["automatic", "manual"]),
});

export type RateSnapshot = z.infer<typeof rateSnapshotSchema>;

export const expenseContextSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("group"), groupId: z.uuid() }),
  z.object({ type: z.literal("friend"), friendshipId: z.uuid() }),
]);

export type ExpenseContext = z.infer<typeof expenseContextSchema>;

const uniqueParticipantIds = (
  ids: readonly string[],
  context: z.RefinementCtx,
) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      message: "A participant may only appear once",
    });
  }
};

export const paymentInputSchema = z
  .array(
    z.object({
      userId: z.string().min(1),
      amountMinor: z.string().regex(/^[1-9]\d*$/),
    }),
  )
  .min(1)
  .superRefine((payments, context) =>
    uniqueParticipantIds(
      payments.map((payment) => payment.userId),
      context,
    ),
  );

export type PaymentInput = z.infer<typeof paymentInputSchema>;

const itemAllocationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("equal") }),
  z.object({
    mode: z.literal("exact"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          amountMinor: z.string().regex(/^\d+$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
  z.object({
    mode: z.literal("percentage"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          percentage: z.string().regex(/^\d{1,3}(?:\.\d{1,4})?$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
  z.object({
    mode: z.literal("shares"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          shares: z.string().regex(/^\d+$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
]);

export const splitInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("equal"),
    participantIds: z
      .array(z.string().min(1))
      .min(1)
      .superRefine(uniqueParticipantIds),
  }),
  z.object({
    mode: z.literal("exact"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          amountMinor: z.string().regex(/^\d+$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
  z.object({
    mode: z.literal("percentage"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          percentage: z.string().regex(/^\d{1,3}(?:\.\d{1,4})?$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
  z.object({
    mode: z.literal("shares"),
    shares: z
      .array(
        z.object({
          userId: z.string().min(1),
          shares: z.string().regex(/^\d+$/),
        }),
      )
      .min(1)
      .superRefine((shares, context) =>
        uniqueParticipantIds(
          shares.map((share) => share.userId),
          context,
        ),
      ),
  }),
  z.object({
    mode: z.literal("itemized"),
    items: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          description: z.string().trim().max(160),
          amountMinor: z.string().regex(/^\d+$/),
          participantIds: z
            .array(z.string().min(1))
            .min(1)
            .superRefine(uniqueParticipantIds),
          allocation: itemAllocationSchema.optional(),
        }),
      )
      .min(1),
  }),
]);

export type SplitInput = z.infer<typeof splitInputSchema>;

export const balanceBucketSchema = z.object({
  contextId: z.string(),
  contextType: z.enum(["group", "friend"]),
  viewerAmount: moneySchema,
  counterpartyAmount: moneySchema,
});

export type BalanceBucket = z.infer<typeof balanceBucketSchema>;

export const quoteRequestSchema = z.object({
  base: currencyCodeSchema,
  targets: z.array(currencyCodeSchema).min(1).max(32),
});

export const quoteResultSchema = z.object({
  id: z.uuid(),
  expiresAt: z.iso.datetime(),
  rates: z.array(rateSnapshotSchema),
});

export type QuoteResult = z.infer<typeof quoteResultSchema>;

export const expenseMutationSchema = z
  .object({
    context: expenseContextSchema,
    clientMutationId: z.uuid(),
    expectedVersion: z.number().int().positive().optional(),
    description: z.string().trim().min(1).max(160),
    iconKey: expenseIconKeySchema.optional(),
    iconManuallySet: z.boolean().default(false),
    notes: z.string().trim().max(2_000).default(""),
    occurredAt: z.iso.datetime(),
    /** @deprecated Accepted for compatibility with older mobile clients. */
    payerId: z.string().min(1).optional(),
    payments: paymentInputSchema.optional(),
    amount: moneySchema.refine((value) => BigInt(value.minor) > 0n, {
      message: "Expense amount must be positive",
    }),
    split: splitInputSchema,
    quoteId: z.uuid().optional(),
    rateOverrides: z.array(rateSnapshotSchema).default([]),
  })
  .superRefine((value, context) => {
    if (!value.payments && !value.payerId) {
      context.addIssue({
        code: "custom",
        path: ["payments"],
        message: "At least one payer is required",
      });
    }
  });

export type ExpenseMutation = z.infer<typeof expenseMutationSchema>;

export const settlementMutationSchema = z.object({
  context: expenseContextSchema,
  clientMutationId: z.uuid(),
  expectedVersion: z.number().int().positive().optional(),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: moneySchema.refine((value) => BigInt(value.minor) > 0n),
  canonicalCurrency: currencyCodeSchema,
  occurredAt: z.iso.datetime(),
  notes: z.string().trim().max(2_000).default(""),
  quoteId: z.uuid().optional(),
  rateOverrides: z.array(rateSnapshotSchema).default([]),
});

export type SettlementMutation = z.infer<typeof settlementMutationSchema>;
