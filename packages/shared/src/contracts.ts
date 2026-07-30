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

export const splitInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("equal"),
    participantIds: z.array(z.string().min(1)).min(1),
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

export const expenseMutationSchema = z.object({
  context: expenseContextSchema,
  clientMutationId: z.uuid(),
  expectedVersion: z.number().int().positive().optional(),
  description: z.string().trim().min(1).max(160),
  iconKey: expenseIconKeySchema.optional(),
  iconManuallySet: z.boolean().default(false),
  notes: z.string().trim().max(2_000).default(""),
  occurredAt: z.iso.datetime(),
  payerId: z.string().min(1),
  amount: moneySchema.refine((value) => BigInt(value.minor) > 0n, {
    message: "Expense amount must be positive",
  }),
  split: splitInputSchema,
  quoteId: z.uuid().optional(),
  rateOverrides: z.array(rateSnapshotSchema).default([]),
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
