import { friendships, groupMembers, type SQL } from "@splidly/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { restoreExpenseArchives } from "../src/domain/expense-archives";
import type { DbTransaction } from "../src/domain/finance";

function transaction() {
  const writes: {
    table: unknown;
    values: unknown;
    sql: string;
    params: unknown[];
  }[] = [];
  const tx = {
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async (filter: SQL) => {
          const query = new PgDialect().sqlToQuery(filter);
          writes.push({ table, values, sql: query.sql, params: query.params });
        },
      }),
    }),
  } as unknown as DbTransaction;
  return { tx, writes };
}
const financials = {
  payments: new Map([["alice", 100n]]),
  sourceShares: new Map([
    ["alice", 50n],
    ["bob", 50n],
    ["uninvolved", 0n],
  ]),
};

describe("new expense archive restoration", () => {
  it("restores a group for its active members and only friendships between involved users", async () => {
    const { tx, writes } = transaction();
    await restoreExpenseArchives(
      tx,
      { type: "group", groupId: "trip" },
      financials,
    );
    expect(writes).toHaveLength(2);
    expect(writes[0]?.table).toBe(groupMembers);
    expect(writes[0]?.values).toEqual({ archivedAt: null });
    expect(writes[0]?.params).toEqual(["trip"]);
    expect(writes[0]?.sql).toContain('"group_member"."removed_at" is null');
    expect(writes[0]?.sql).toContain(
      '"group_member"."archived_at" is not null',
    );
    expect(writes[1]?.table).toBe(friendships);
    expect(writes[1]?.values).toEqual({
      archivedByLowAt: null,
      archivedByHighAt: null,
    });
    expect(writes[1]?.params).toEqual(["alice", "bob", "alice", "bob"]);
    expect(writes[1]?.sql).toContain('"friendship"."removed_at" is null');
  });

  it("restores both sides of a direct ledger without changing another ledger", async () => {
    const { tx, writes } = transaction();
    await restoreExpenseArchives(
      tx,
      { type: "friend", friendshipId: "direct" },
      financials,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.table).toBe(friendships);
    expect(writes[0]?.values).toEqual({
      archivedByLowAt: null,
      archivedByHighAt: null,
    });
    expect(writes[0]?.params).toEqual(["direct"]);
    expect(writes[0]?.sql).toContain('"friendship"."removed_at" is null');
  });

  it("reactivates the group without restoring unrelated friends for a self-only expense", async () => {
    const { tx, writes } = transaction();
    await restoreExpenseArchives(
      tx,
      { type: "group", groupId: "trip" },
      {
        payments: new Map([["alice", 100n]]),
        sourceShares: new Map([
          ["alice", 100n],
          ["bob", 0n],
        ]),
      },
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.table).toBe(groupMembers);
  });
});
