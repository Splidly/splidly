import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createDatabase, eq, groupMembers, groups, expenses, profiles, users, invites, sql } from "@splidly/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { groupsRouter } from "../src/routers/groups";
import { expensesRouter } from "../src/routers/expenses";
import { settlementsRouter } from "../src/routers/settlements";
import { hashInviteToken, invitesRouter } from "../src/routers/invites";
import { groupWriteProcedure } from "../src/domain/group-write";
import { router, type TrpcContext } from "../src/trpc";

// Use a dedicated database, never DATABASE_URL or a developer's application data.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("serialized group mutations in PostgreSQL", () => {
  const { db, pool } = createDatabase(url ?? "postgresql://unused");
  const logger = { child: () => logger, debug() {}, info() {}, warn() {}, error() {} };
  const context = (userId: string) => ({ db, logger, session: { user: { id: userId } } }) as unknown as TrpcContext;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)) });
  }, 60_000);
  afterAll(() => pool.end());

  async function seed() {
    const alice = randomUUID();
    const bob = randomUUID();
    const groupId = randomUUID();
    await db.insert(users).values([alice, bob].map(id => ({ id, name: id, email: `${id}@test.invalid` })));
    await db.insert(profiles).values([alice, bob].map(userId => ({ userId, displayName: userId, homeCurrency: "EUR", notificationsEnabled: false })));
    await db.insert(groups).values({ id: groupId, name: "Concurrency test", createdBy: alice, currency: "EUR" });
    await db.insert(groupMembers).values([alice, bob].map(userId => ({ groupId, userId })));
    return { alice, bob, groupId };
  }

  async function queuedRace(groupId: string, first: () => Promise<unknown>, second: () => Promise<unknown>) {
    const blocker = await pool.connect();
    const jobs: Promise<unknown>[] = [];
    async function waitForWaiters(count: number) {
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const result = await pool.query("select count(*)::int as count from pg_locks where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database())");
        if (result.rows[0].count >= count) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`Expected ${count} group operations waiting for the lock`);
    }
    try {
      await blocker.query("begin");
      await blocker.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`splidly:group:${groupId}`]);
      jobs.push(first());
      void jobs[0]!.catch(() => {});
      await waitForWaiters(1);
      jobs.push(second());
      void jobs[1]!.catch(() => {});
      await waitForWaiters(2);
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
    return Promise.allSettled(jobs);
  }

  const expense = (groupId: string, alice: string, bob: string) => ({
    context: { type: "group" as const, groupId }, clientMutationId: randomUUID(),
    description: "Shared dinner", payerId: alice, amount: { currency: "EUR" as const, minor: "10000" },
    occurredAt: new Date().toISOString(), split: { mode: "equal" as const, participantIds: [alice, bob] },
  });

  it("does not allow both remaining members to leave concurrently", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => groupsRouter.createCaller(context(alice)).leave({ groupId }),
      () => groupsRouter.createCaller(context(bob)).leave({ groupId: groupId.toUpperCase() }));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "PRECONDITION_FAILED" } });
    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    expect(members.filter(member => !member.removedAt)).toHaveLength(1);
  });

  it("checks balances after a concurrent expense commits and preserves its data", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => expensesRouter.createCaller(context(alice)).create(expense(groupId, alice, bob)),
      () => groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 }));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "PRECONDITION_FAILED" } });
    const [record] = await db.select().from(expenses).where(eq(expenses.groupId, groupId));
    expect(record).toBeDefined();
    await expensesRouter.createCaller(context(alice)).update({ ...expense(groupId, alice, bob),
      expenseId: record!.id, expectedVersion: 1, amount: { currency: "EUR", minor: "12000" } });
    await expensesRouter.createCaller(context(alice)).remove({ expenseId: record!.id, expectedVersion: 2 });
    await expect(groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 })).resolves.toEqual({ deleted: true });
  });

  it("rejects an expense when a queued group deletion wins", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 }),
      () => expensesRouter.createCaller(context(alice)).create(expense(groupId, alice, bob)));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
    expect(await db.select().from(expenses).where(eq(expenses.groupId, groupId))).toHaveLength(0);
  });

  it("revalidates participants after a member leaves", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => groupsRouter.createCaller(context(bob)).leave({ groupId }),
      () => expensesRouter.createCaller(context(alice)).create(expense(groupId, alice, bob)));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "BAD_REQUEST" } });
  });

  it("serializes payments with group deletion and still allows reversing a payment", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => settlementsRouter.createCaller(context(alice)).create({
        context: { type: "group", groupId }, clientMutationId: randomUUID(), fromUserId: alice, toUserId: bob,
        amount: { currency: "EUR", minor: "1000" }, canonicalCurrency: "EUR", occurredAt: new Date().toISOString(),
      }),
      () => groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 }));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "PRECONDITION_FAILED" } });
    if (results[0]!.status !== "fulfilled") throw new Error("Payment failed");
    const payment = results[0]!.value as { id: string };
    await settlementsRouter.createCaller(context(alice)).update({
      context: { type: "group", groupId }, clientMutationId: randomUUID(), settlementId: payment.id,
      expectedVersion: 1, fromUserId: alice, toUserId: bob, amount: { currency: "EUR", minor: "2000" },
      canonicalCurrency: "EUR", occurredAt: new Date().toISOString(),
    });
    await settlementsRouter.createCaller(context(alice)).remove({ settlementId: payment.id, expectedVersion: 2 });
    await expect(groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 })).resolves.toEqual({ deleted: true });
  });

  it("does not change group currency after a queued expense is created", async () => {
    const { alice, bob, groupId } = await seed();
    const results = await queuedRace(groupId,
      () => expensesRouter.createCaller(context(alice)).create(expense(groupId, alice, bob)),
      () => groupsRouter.createCaller(context(alice)).update({ groupId, expectedVersion: 1, name: "Updated", currency: "USD", simplifyDebts: true }));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "PRECONDITION_FAILED" } });
  });

  it("rolls back writes when tRPC returns a handler error", async () => {
    const { alice, groupId } = await seed();
    const failing = router({ write: groupWriteProcedure.input(z.object({ groupId: z.uuid() })).mutation(async ({ ctx, input }) => {
      await ctx.db.update(groups).set({ name: "Must roll back" }).where(eq(groups.id, input.groupId));
      throw new TRPCError({ code: "BAD_REQUEST" });
    }) });
    await expect(failing.createCaller(context(alice)).write({ groupId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    expect(group!.name).toBe("Concurrency test");
    await db.execute(sql`select 1`);
  });

  it("does not accept an invitation into a group that is being deleted", async () => {
    const { alice, groupId } = await seed();
    const newcomer = randomUUID();
    await db.insert(users).values({ id: newcomer, name: "New member", email: `${newcomer}@test.invalid` });
    await db.insert(profiles).values({ userId: newcomer, displayName: "New member" });
    const token = randomUUID();
    const request = { token, inviteId: randomUUID() };
    await db.insert(invites).values({ kind: "group", groupId, inviterId: alice,
      tokenHash: hashInviteToken(token), expiresAt: new Date(Date.now() + 60_000) });
    const results = await queuedRace(groupId,
      () => groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 }),
      () => invitesRouter.createCaller(context(newcomer)).accept(request));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "NOT_FOUND" } });
  });

  it("ignores unexpected reference ids when choosing the lock for a new expense", async () => {
    const { alice, bob, groupId } = await seed();
    const other = await seed();
    const foreign = await expensesRouter.createCaller(context(other.alice)).create(expense(other.groupId, other.alice, other.bob));
    const request = { ...expense(groupId, alice, bob), expenseId: foreign.id };
    const results = await queuedRace(groupId,
      () => expensesRouter.createCaller(context(alice)).create(request),
      () => groupsRouter.createCaller(context(alice)).delete({ groupId, expectedVersion: 1 }));
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "PRECONDITION_FAILED" } });
  });
});
