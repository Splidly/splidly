import { type Database, type SQL } from "@splidly/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { expect, it, vi } from "vitest";
import { loadExpensePreviewDebts } from "../src/domain/expense-preview-debts";

it("does not query for an empty authorized expense list", async () => {
  const select = vi.fn();
  expect(await loadExpensePreviewDebts({ select } as unknown as Database, [], "viewer")).toEqual(new Map());
  expect(select).not.toHaveBeenCalled();
});

it("loads only active allocations from authorized expense ids, including multiple payers", async () => {
  const dialect = new PgDialect();
  const joins: string[] = [];
  let filter: { sql: string; params: unknown[] } | undefined;
  const query = {
    from: () => query,
    leftJoin: (_table: unknown, condition: SQL) => {
      joins.push(dialect.sqlToQuery(condition).sql);
      return query;
    },
    where: (condition: SQL) => {
      filter = dialect.sqlToQuery(condition);
      return query;
    },
    orderBy: async () => [
      { expenseId: "dinner", debtorId: "viewer", creditorId: "anna", debtorName: "Me", creditorName: "Anna", currency: "EUR", minor: 1200n },
      { expenseId: "dinner", debtorId: "ben", creditorId: "anna", debtorName: "Ben", creditorName: "Anna", currency: "EUR", minor: 800n },
      { expenseId: "taxi", debtorId: "anna", creditorId: "viewer", debtorName: null, creditorName: "Me", currency: "USD", minor: 500n },
      { expenseId: "taxi", debtorId: "anna", creditorId: "viewer", debtorName: "Anna", creditorName: "Me", currency: "USD", minor: 0n },
    ],
  };
  const db = { select: () => query } as unknown as Database;
  const debts = await loadExpensePreviewDebts(db, ["dinner", "taxi"], "viewer");
  expect(filter?.params).toEqual(["expense", "dinner", "taxi"]);
  expect(filter?.sql).toContain('"ledger_entry"."source_id" in');
  expect(filter?.sql).toContain('"ledger_entry"."reversal_of_id" is null');
  expect(filter?.sql).toContain('"preview_reversal"."id" is null');
  expect(joins).toContain('"preview_reversal"."reversal_of_id" = "ledger_entry"."id"');
  expect(debts.get("dinner")).toEqual([
    { from: { displayName: "Me", isViewer: true }, to: { displayName: "Anna", isViewer: false }, amount: { currency: "EUR", minor: "1200" } },
    { from: { displayName: "Ben", isViewer: false }, to: { displayName: "Anna", isViewer: false }, amount: { currency: "EUR", minor: "800" } },
  ]);
  expect(debts.get("taxi")).toEqual([
    { from: { displayName: "Deleted user", isViewer: false }, to: { displayName: "Me", isViewer: true }, amount: { currency: "USD", minor: "500" } },
  ]);
});
