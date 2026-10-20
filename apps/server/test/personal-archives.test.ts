import {
  friendships,
  groupMembers,
  type Database,
  type SQL,
} from "@splidly/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { friendsRouter } from "../src/routers/friends";
import { groupsRouter } from "../src/routers/groups";
import type { TrpcContext } from "../src/trpc";

const id = "00000000-0000-4000-8000-000000000001";
const friendship = {
  id,
  userLowId: "alice",
  userHighId: "bob",
  removedAt: null,
};
const dialect = new PgDialect();

function context(userId: string, results: unknown[][]) {
  const writes: {
    table: unknown;
    values: unknown;
    filter: ReturnType<PgDialect["sqlToQuery"]>;
  }[] = [];
  const filters: string[] = [];
  const db = {
    select: () => {
      const result = results.shift() ?? [];
      const query = {
        from: () => query,
        innerJoin: () => query,
        limit: () => query,
        groupBy: () => query,
        having: () => query,
        where: (filter: SQL) => {
          filters.push(dialect.sqlToQuery(filter).sql);
          return query;
        },
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    },
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async (filter: SQL) => {
          writes.push({ table, values, filter: dialect.sqlToQuery(filter) });
        },
      }),
    }),
  } as unknown as Database;
  const logger = {
    child: () => logger,
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    ctx: {
      db,
      logger,
      session: { user: { id: userId } },
    } as unknown as TrpcContext,
    writes,
    filters,
  };
}

describe("personal archives", () => {
  it.each(["alice", "bob"])(
    "archives and restores only %s's side of a friendship",
    async (user) => {
      const { ctx, writes } = context(user, [
        [friendship],
        [friendship],
        [],
        [],
        [],
        [friendship],
      ]);
      const caller = friendsRouter.createCaller(ctx);
      await caller.archive({ friendshipId: id });
      await caller.restore({ friendshipId: id });
      const field = user === "alice" ? "archivedByLowAt" : "archivedByHighAt";
      expect(writes).toHaveLength(2);
      expect(writes[0]?.table).toBe(friendships);
      expect(writes[0]?.values).toEqual({ [field]: expect.any(Date) });
      expect(writes[1]?.values).toEqual({ [field]: null });
    },
  );

  it("rejects archiving someone else's friendship", async () => {
    const { ctx, writes } = context("charlie", [[friendship]]);
    await expect(
      friendsRouter.createCaller(ctx).archive({ friendshipId: id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });

  it("rejects a friend with an unsettled direct balance", async () => {
    const entry = {
      id: "entry",
      contextType: "friend",
      contextId: id,
      debtorId: "bob",
      creditorId: "alice",
      canonicalCurrency: "EUR",
      canonicalAmountMinor: 100n,
    };
    const { ctx, writes } = context("alice", [
      [friendship],
      [friendship],
      [],
      [],
      [entry],
      [
        {
          ledgerEntryId: "entry",
          userId: "alice",
          currency: "EUR",
          amountMinor: 100n,
        },
        {
          ledgerEntryId: "entry",
          userId: "bob",
          currency: "EUR",
          amountMinor: 100n,
        },
      ],
    ]);
    await expect(
      friendsRouter.createCaller(ctx).archive({ friendshipId: id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(writes).toHaveLength(0);
  });

  it("archives only the viewer's group membership, then restores it", async () => {
    const { ctx, writes } = context("alice", [
      [{ userId: "alice" }],
      [{ simplifyDebts: true }],
      [],
      [{ userId: "alice" }],
    ]);
    const caller = groupsRouter.createCaller(ctx);
    await caller.archive({ groupId: id, expectedVersion: 1 });
    await caller.restore({ groupId: id });
    expect(writes.map((write) => write.table)).toEqual([
      groupMembers,
      groupMembers,
    ]);
    expect(writes[0]?.values).toEqual({ archivedAt: expect.any(Date) });
    expect(writes[1]?.values).toEqual({ archivedAt: null });
    expect(writes[0]?.filter.params).toEqual([id, "alice"]);
  });

  it.each([true, false])(
    "blocks unsettled group balances (simplification %s)",
    async (simplifyDebts) => {
      const { ctx, writes } = context("alice", [
        [{ userId: "alice" }],
        [{ simplifyDebts }],
        [
          {
            contextId: id,
            debtorId: "alice",
            creditorId: "bob",
            amountMinor: "100",
          },
        ],
      ]);
      await expect(
        groupsRouter
          .createCaller(ctx)
          .archive({ groupId: id, expectedVersion: 1 }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(writes).toHaveLength(0);
    },
  );

  it("blocks offsetting but unsettled debts when simplification is off", async () => {
    const { ctx, writes } = context("alice", [
      [{ userId: "alice" }],
      [{ simplifyDebts: false }],
      [
        {
          contextId: id,
          debtorId: "alice",
          creditorId: "bob",
          amountMinor: "100",
        },
        {
          contextId: id,
          debtorId: "charlie",
          creditorId: "alice",
          amountMinor: "100",
        },
      ],
    ]);
    await expect(
      groupsRouter
        .createCaller(ctx)
        .archive({ groupId: id, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(writes).toHaveLength(0);
  });

  it("rejects a non-member's group archive and restore", async () => {
    const { ctx, writes } = context("charlie", [[], []]);
    const caller = groupsRouter.createCaller(ctx);
    await expect(
      caller.archive({ groupId: id, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.restore({ groupId: id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(writes).toHaveLength(0);
  });

  it("filters friendship archives independently for both participants", async () => {
    const { ctx, filters } = context("alice", [[], [], [], []]);
    const caller = friendsRouter.createCaller(ctx);
    await caller.list();
    await caller.list({ archived: true });
    const friendFilters = filters.filter((filter) => filter.includes('"friendship"'));
    expect(friendFilters[0]).toContain('"friendship"."archived_by_low_at" is null');
    expect(friendFilters[0]).toContain('"friendship"."archived_by_high_at" is null');
    expect(friendFilters[1]).toContain('"friendship"."archived_by_low_at" is not null');
    expect(friendFilters[1]).toContain('"friendship"."archived_by_high_at" is not null');
  });

  it("separates active and archived group queries per member", async () => {
    const { ctx, filters } = context("alice", [[], []]);
    const caller = groupsRouter.createCaller(ctx);
    await caller.list();
    await caller.list({ archived: true });
    expect(filters[0]).toContain('"group_member"."archived_at" is null');
    expect(filters[1]).toContain('"group_member"."archived_at" is not null');
  });
});

it("counts only the viewer's archived groups and friendships", async () => {
  const { ctx, filters } = context("alice", [[{ count: 3 }], [{ count: 2 }]]);
  await expect(groupsRouter.createCaller(ctx).archivedCount()).resolves.toBe(3);
  await expect(friendsRouter.createCaller(ctx).archivedCount()).resolves.toBe(2);
  expect(filters[0]).toContain('"group_member"."archived_at" is not null');
  expect(filters[0]).toContain('"group_member"."removed_at" is null');
  expect(filters[1]).toContain('"friendship"."archived_by_low_at" is not null');
  expect(filters[1]).toContain('"friendship"."archived_by_high_at" is not null');
  expect(filters[1]).toContain('"friendship"."removed_at" is null');
});
