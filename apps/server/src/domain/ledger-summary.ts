import {
  and,
  type Database,
  eq,
  inArray,
  ledgerEntries,
  sql,
} from "@splidly/db";
import type { LedgerAmount } from "./debt-simplification";

export type GroupedLedgerAmount = LedgerAmount & { contextId: string };

/**
 * Collapses an append-only ledger (including reversal rows) in PostgreSQL.
 * Balance endpoints only need the net amount per directed pair, so returning
 * every historical row wastes network, decoding, and JavaScript processing.
 */
export async function loadGroupedLedgerAmounts(
  db: Database,
  contextType: "group" | "friend",
  contextIds: string[],
): Promise<GroupedLedgerAmount[]> {
  const uniqueContextIds = [...new Set(contextIds)];
  if (uniqueContextIds.length === 0) return [];

  const rows = await db
    .select({
      contextId: ledgerEntries.contextId,
      debtorId: ledgerEntries.debtorId,
      creditorId: ledgerEntries.creditorId,
      amountMinor: sql<string>`sum(${ledgerEntries.canonicalAmountMinor})::text`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.contextType, contextType),
        inArray(ledgerEntries.contextId, uniqueContextIds),
      ),
    )
    .groupBy(
      ledgerEntries.contextId,
      ledgerEntries.debtorId,
      ledgerEntries.creditorId,
    )
    .having(sql`sum(${ledgerEntries.canonicalAmountMinor}) <> 0`);

  return rows.map((row) => ({
    contextId: row.contextId,
    debtorId: row.debtorId,
    creditorId: row.creditorId,
    canonicalAmountMinor: BigInt(row.amountMinor),
  }));
}
