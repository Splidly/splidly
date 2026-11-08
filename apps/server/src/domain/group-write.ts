import { eq, expenses, settlements, sql, type Database } from "@splidly/db";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

type ResolveGroup = (db: Database, raw: unknown) => Promise<string | undefined>;

export function serializeGroupWrites(resolveGroup: ResolveGroup) {
  return protectedProcedure.use(async ({ ctx, getRawInput, next }) => {
    const groupId = await resolveGroup(ctx.db, await getRawInput());
    if (!groupId) return next();
    return ctx.db.transaction(async tx => {
      // Every group writer takes this lock before validation or row locks.
      // The namespace also protects a deleted group's id until commit.
      // PostgreSQL UUIDs are case-insensitive; the advisory key must be too.
      const lockKey = `splidly:group:${groupId.toLowerCase()}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const result = await next({ ctx: { ...ctx, db: tx } });
      // tRPC returns handler errors as results. Throw so PostgreSQL rolls back.
      if (!result.ok) throw result.error;
      return result;
    });
  });
}

const groupInput = z.object({ groupId: z.uuid() });
const contextInput = z.object({ context: z.object({ type: z.literal("group"), groupId: z.uuid() }) });

export const groupWriteProcedure = serializeGroupWrites(async (_db, raw) => {
  const input = groupInput.safeParse(raw);
  return input.success ? input.data.groupId : undefined;
});

// Create handlers use only their context. Update/delete handlers use only the
// stored record. Unknown extra input fields must never select a different lock.
export const groupContextWriteProcedure = serializeGroupWrites(async (_db, raw) => {
  const context = contextInput.safeParse(raw);
  return context.success ? context.data.context.groupId : undefined;
});

export const expenseWriteProcedure = serializeGroupWrites(async (db, raw) => {
  const input = z.object({ expenseId: z.uuid() }).safeParse(raw);
  if (input.success) {
    const [expense] = await db.select({ groupId: expenses.groupId }).from(expenses)
      .where(eq(expenses.id, input.data.expenseId)).limit(1);
    return expense?.groupId ?? undefined;
  }
  return undefined;
});

export const settlementWriteProcedure = serializeGroupWrites(async (db, raw) => {
  const input = z.object({ settlementId: z.uuid() }).safeParse(raw);
  if (input.success) {
    const [settlement] = await db.select({ groupId: settlements.groupId }).from(settlements)
      .where(eq(settlements.id, input.data.settlementId)).limit(1);
    return settlement?.groupId ?? undefined;
  }
  return undefined;
});
