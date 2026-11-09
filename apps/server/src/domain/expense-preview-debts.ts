import { and, eq, inArray, isNull, ledgerEntries, profiles, type Database } from "@splidly/db";
import { money, type CurrencyCode } from "@splidly/shared";
import { alias } from "drizzle-orm/pg-core";

// Call only with expenses already authorized by the enclosing detail endpoint.
// Use the stored allocation, excluding both reversals and reversed revisions.
export async function loadExpensePreviewDebts(db: Database, expenseIds: string[], viewerId: string) {
  if (expenseIds.length === 0) return new Map<string, ExpensePreviewDebt[]>();
  const debtor = alias(profiles, "preview_debtor");
  const creditor = alias(profiles, "preview_creditor");
  const reversal = alias(ledgerEntries, "preview_reversal");
  const entries = await db.select({
    expenseId: ledgerEntries.sourceId,
    debtorId: ledgerEntries.debtorId,
    creditorId: ledgerEntries.creditorId,
    debtorName: debtor.displayName,
    creditorName: creditor.displayName,
    currency: ledgerEntries.canonicalCurrency,
    minor: ledgerEntries.canonicalAmountMinor,
  }).from(ledgerEntries)
    .leftJoin(debtor, eq(debtor.userId, ledgerEntries.debtorId))
    .leftJoin(creditor, eq(creditor.userId, ledgerEntries.creditorId))
    .leftJoin(reversal, eq(reversal.reversalOfId, ledgerEntries.id))
    .where(and(
      eq(ledgerEntries.sourceType, "expense"),
      inArray(ledgerEntries.sourceId, expenseIds),
      isNull(ledgerEntries.reversalOfId),
      isNull(reversal.id),
    ))
    .orderBy(ledgerEntries.debtorId, ledgerEntries.creditorId);
  const result = new Map<string, ExpensePreviewDebt[]>();
  for (const entry of entries) {
    if (entry.minor <= 0n) continue;
    const rows = result.get(entry.expenseId) ?? [];
    rows.push({
      from: { displayName: entry.debtorName ?? "Deleted user", isViewer: entry.debtorId === viewerId },
      to: { displayName: entry.creditorName ?? "Deleted user", isViewer: entry.creditorId === viewerId },
      amount: money(entry.currency as CurrencyCode, entry.minor),
    });
    result.set(entry.expenseId, rows);
  }
  return result;
}

export type ExpensePreviewDebt = {
  from: { displayName: string; isViewer: boolean };
  to: { displayName: string; isViewer: boolean };
  amount: ReturnType<typeof money>;
};
