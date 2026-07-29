import {
  and,
  currencyQuotes,
  eq,
  ledgerEntries,
  ledgerValuations,
  profiles,
  type Database,
} from "@splidly/db";
import {
  convertMinor,
  type CurrencyCode,
  type RateSnapshot,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";

type TransactionCallback = Parameters<Database["transaction"]>[0];
export type DbTransaction = Parameters<TransactionCallback>[0];

export async function resolveRates(input: {
  db: Database;
  userId: string;
  base: CurrencyCode;
  targets: CurrencyCode[];
  quoteId: string | undefined;
  overrides: RateSnapshot[];
  fallbackRates?: RateSnapshot[];
}): Promise<RateSnapshot[]> {
  const targets = [...new Set(input.targets)];
  let automatic: RateSnapshot[] = [];
  if (input.quoteId) {
    const [quote] = await input.db
      .select()
      .from(currencyQuotes)
      .where(
        and(
          eq(currencyQuotes.id, input.quoteId),
          eq(currencyQuotes.userId, input.userId),
        ),
      )
      .limit(1);
    if (!quote || quote.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "The exchange-rate quote expired; refresh it before saving",
      });
    }
    if (quote.base !== input.base) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Quote base mismatch" });
    }
    automatic = quote.rates as RateSnapshot[];
  }

  return targets.map((target) => {
    if (target === input.base) {
      return {
        base: input.base,
        quote: target,
        rate: "1",
        provider: "identity",
        providerDate: new Date().toISOString().slice(0, 10),
        source: "automatic",
      };
    }
    const override = input.overrides.find(
      (rate) => rate.base === input.base && rate.quote === target,
    );
    if (override) {
      return { ...override, source: "manual" };
    }
    const rate = automatic.find(
      (candidate) =>
        candidate.base === input.base && candidate.quote === target,
    );
    if (rate) return rate;
    const fallback = input.fallbackRates?.find(
      (candidate) =>
        candidate.base === input.base && candidate.quote === target,
    );
    if (!fallback) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `A ${input.base}/${target} rate is required`,
      });
    }
    return fallback;
  });
}

export function convertWithRates(
  amount: bigint,
  base: CurrencyCode,
  target: CurrencyCode,
  rates: RateSnapshot[],
): bigint {
  if (base === target) return amount;
  const snapshot = rates.find(
    (rate) => rate.base === base && rate.quote === target,
  );
  if (!snapshot) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Missing ${base}/${target} conversion`,
    });
  }
  return convertMinor(amount, base, target, snapshot.rate);
}

export async function loadHomeCurrencies(
  db: Database,
  userIds: string[],
): Promise<Map<string, CurrencyCode>> {
  const values = new Map<string, CurrencyCode>();
  for (const userId of [...new Set(userIds)]) {
    const [profile] = await db
      .select({ homeCurrency: profiles.homeCurrency })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!profile) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Every participant must finish onboarding",
      });
    }
    values.set(userId, profile.homeCurrency as CurrencyCode);
  }
  return values;
}

export async function reverseActiveEntries(
  tx: DbTransaction,
  sourceType: "expense" | "settlement",
  sourceId: string,
): Promise<void> {
  const existing = await tx
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.sourceType, sourceType),
        eq(ledgerEntries.sourceId, sourceId),
      ),
    );
  const alreadyReversed = new Set(
    existing
      .map((entry) => entry.reversalOfId)
      .filter((id): id is string => id !== null),
  );
  const active = existing.filter(
    (entry) => !entry.reversalOfId && !alreadyReversed.has(entry.id),
  );
  for (const entry of active) {
    const [reversal] = await tx
      .insert(ledgerEntries)
      .values({
        sourceType,
        sourceId,
        contextType: entry.contextType,
        contextId: entry.contextId,
        debtorId: entry.creditorId,
        creditorId: entry.debtorId,
        canonicalCurrency: entry.canonicalCurrency,
        canonicalAmountMinor: entry.canonicalAmountMinor,
        reversalOfId: entry.id,
      })
      .returning();
    if (!reversal) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const values = await tx
      .select()
      .from(ledgerValuations)
      .where(eq(ledgerValuations.ledgerEntryId, entry.id));
    if (values.length > 0) {
      await tx.insert(ledgerValuations).values(
        values.map((value) => ({
          ledgerEntryId: reversal.id,
          userId: value.userId,
          currency: value.currency,
          amountMinor: value.amountMinor,
        })),
      );
    }
  }
}
