import {
  and,
  eq,
  expenseSplits,
  expensePayments,
  expenses,
  financialRevisions,
  groupMembers,
  groups,
  inArray,
  invites,
  isNull,
  ledgerEntries,
  ledgerValuations,
  or,
  profiles,
  rateSnapshots,
  settlements,
} from "@splidly/db";
import {
  convertMinor,
  currencyCodeSchema,
  groupColorPresets,
  groupColorSchema,
  groupIconKeySchema,
  money,
  type CurrencyCode,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  repaymentPlan,
  viewerRepaymentBalances,
} from "../domain/debt-simplification";
import { requireActiveGroupMember } from "../domain/helpers";
import { protectedProcedure, router } from "../trpc";

function groupBalance(
  entries: (typeof ledgerEntries.$inferSelect)[],
  userId: string,
) {
  return entries.reduce((sum, entry) => {
    if (entry.creditorId === userId) return sum + entry.canonicalAmountMinor;
    if (entry.debtorId === userId) return sum - entry.canonicalAmountMinor;
    return sum;
  }, 0n);
}

async function removeGroupMember(input: {
  ctx: Parameters<typeof requireActiveGroupMember> extends never ? never : any;
  groupId: string;
  userId: string;
}) {
  const { ctx, groupId, userId } = input;
  await requireActiveGroupMember(ctx.db, groupId, ctx.session.user.id);
  const entries = await ctx.db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.contextType, "group"),
        eq(ledgerEntries.contextId, groupId),
        or(
          eq(ledgerEntries.debtorId, userId),
          eq(ledgerEntries.creditorId, userId),
        ),
      ),
    );
  if (groupBalance(entries, userId) !== 0n) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Member balance must be zero",
    });
  }
  const active = await ctx.db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.removedAt),
      ),
    );
  if (active.length <= 1) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The final member must archive the group",
    });
  }
  await ctx.db
    .update(groupMembers)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
      ),
    );
  return { removed: true };
}

export const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db
      .select({ group: groups })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(
        and(
          eq(groupMembers.userId, ctx.session.user.id),
          isNull(groupMembers.removedAt),
          isNull(groups.archivedAt),
        ),
      );

    return Promise.all(
      memberships.map(async ({ group }) => {
        const entries = await ctx.db
          .select()
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.contextType, "group"),
              eq(ledgerEntries.contextId, group.id),
            ),
          );
        const members = await ctx.db
          .select({
            userId: groupMembers.userId,
            displayName: profiles.displayName,
          })
          .from(groupMembers)
          .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
          .where(
            and(
              eq(groupMembers.groupId, group.id),
              isNull(groupMembers.removedAt),
            ),
          );
        const transfers = repaymentPlan(entries, group.simplifyDebts);
        const memberBalances = viewerRepaymentBalances(
          transfers,
          members,
          ctx.session.user.id,
        ).map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          balance: money(group.currency, member.amountMinor),
        }));
        return {
          ...group,
          balance: money(
            group.currency,
            groupBalance(entries, ctx.session.user.id),
          ),
          memberBalances,
        };
      }),
    );
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        iconKey: groupIconKeySchema.default("default"),
        color: groupColorSchema.optional(),
        currency: currencyCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [group] = await tx
          .insert(groups)
          .values({
            name: input.name,
            iconKey: input.iconKey,
            color:
              input.color ??
              groupColorPresets[
                Math.floor(Math.random() * groupColorPresets.length)
              ],
            currency: input.currency,
            simplifyDebts: true,
            createdBy: ctx.session.user.id,
          })
          .returning();
        if (!group) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await tx.insert(groupMembers).values({
          groupId: group.id,
          userId: ctx.session.user.id,
        });
        return group;
      }),
    ),

  detail: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await requireActiveGroupMember(
        ctx.db,
        input.groupId,
        ctx.session.user.id,
      );
      const [group] = await ctx.db
        .select()
        .from(groups)
        .where(eq(groups.id, input.groupId))
        .limit(1);
      if (!group || group.archivedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const members = await ctx.db
        .select({
          userId: groupMembers.userId,
          joinedAt: groupMembers.joinedAt,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          homeCurrency: profiles.homeCurrency,
        })
        .from(groupMembers)
        .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            isNull(groupMembers.removedAt),
          ),
        );
      const activity = await ctx.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.groupId, input.groupId),
            isNull(expenses.deletedAt),
          ),
        )
        .orderBy(expenses.occurredAt);
      const activityRates =
        activity.length === 0
          ? []
          : await ctx.db
              .select({
                expenseId: rateSnapshots.expenseId,
                base: rateSnapshots.base,
                quote: rateSnapshots.quote,
                rate: rateSnapshots.rate,
              })
              .from(rateSnapshots)
              .where(
                inArray(
                  rateSnapshots.expenseId,
                  activity.map((expense) => expense.id),
                ),
              );
      const groupEntries = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.contextType, "group"),
            eq(ledgerEntries.contextId, group.id),
          ),
        );
      const transfers = repaymentPlan(
        groupEntries,
        group.simplifyDebts,
      );
      const memberBalances = viewerRepaymentBalances(
        transfers,
        members,
        ctx.session.user.id,
      ).map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        balance: money(group.currency, member.amountMinor),
      }));
      const expenseActivity = activity.reverse().map((expense) => {
        const sourceCurrency = expense.sourceCurrency as CurrencyCode;
        const canonicalCurrency = group.currency as CurrencyCode;
        const rate = activityRates.find(
          (candidate) =>
            candidate.expenseId === expense.id &&
            candidate.base === sourceCurrency &&
            candidate.quote === canonicalCurrency,
        );
        const canonicalAmount =
          sourceCurrency === canonicalCurrency
            ? money(canonicalCurrency, expense.sourceAmountMinor)
            : rate
              ? money(
                  canonicalCurrency,
                  convertMinor(
                    expense.sourceAmountMinor,
                    sourceCurrency,
                    canonicalCurrency,
                    rate.rate,
                  ),
                )
              : null;

        return { ...expense, canonicalAmount };
      });
      return {
        group,
        members,
        memberBalances,
        expenses: expenseActivity,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        groupId: z.uuid(),
        expectedVersion: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
        iconKey: groupIconKeySchema.optional(),
        color: groupColorSchema.optional(),
        currency: currencyCodeSchema,
        simplifyDebts: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireActiveGroupMember(
        ctx.db,
        input.groupId,
        ctx.session.user.id,
      );
      const [current] = await ctx.db
        .select()
        .from(groups)
        .where(eq(groups.id, input.groupId))
        .limit(1);
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      if (current.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT" });
      }
      if (current.currency !== input.currency) {
        const expenseRecords = await ctx.db
          .select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.groupId, input.groupId))
          .limit(1);
        const settlementRecords = await ctx.db
          .select({ id: settlements.id })
          .from(settlements)
          .where(eq(settlements.groupId, input.groupId))
          .limit(1);
        if (expenseRecords.length > 0 || settlementRecords.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Group currency is locked after financial activity",
          });
        }
      }
      const [updated] = await ctx.db
        .update(groups)
        .set({
          name: input.name,
          ...(input.iconKey ? { iconKey: input.iconKey } : {}),
          color: input.color ?? current.color,
          currency: input.currency,
          simplifyDebts: input.simplifyDebts,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(groups.id, input.groupId),
            eq(groups.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "CONFLICT" });
      return updated;
    }),

  removeMember: protectedProcedure
    .input(z.object({ groupId: z.uuid(), userId: z.string() }))
    .mutation(({ ctx, input }) =>
      removeGroupMember({
        ctx,
        groupId: input.groupId,
        userId: input.userId,
      }),
    ),

  leave: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .mutation(({ ctx, input }) =>
      removeGroupMember({
        ctx,
        groupId: input.groupId,
        userId: ctx.session.user.id,
      }),
    ),

  archive: protectedProcedure
    .input(z.object({ groupId: z.uuid(), expectedVersion: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveGroupMember(
        ctx.db,
        input.groupId,
        ctx.session.user.id,
      );
      const entries = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.contextType, "group"),
            eq(ledgerEntries.contextId, input.groupId),
          ),
        );
      const members = new Set(
        entries.flatMap((entry) => [entry.debtorId, entry.creditorId]),
      );
      if ([...members].some((id) => groupBalance(entries, id) !== 0n)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "All balances must be zero before archiving",
        });
      }
      const [archived] = await ctx.db
        .update(groups)
        .set({
          archivedAt: new Date(),
          version: input.expectedVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(groups.id, input.groupId),
            eq(groups.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!archived) throw new TRPCError({ code: "CONFLICT" });
      return archived;
    }),

  delete: protectedProcedure
    .input(z.object({ groupId: z.uuid(), expectedVersion: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveGroupMember(
        ctx.db,
        input.groupId,
        ctx.session.user.id,
      );
      const [group] = await ctx.db
        .select()
        .from(groups)
        .where(eq(groups.id, input.groupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      if (group.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the group creator can delete this group",
        });
      }
      if (group.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT" });
      }

      const entries = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.contextType, "group"),
            eq(ledgerEntries.contextId, input.groupId),
          ),
        );
      const participants = new Set(
        entries.flatMap((entry) => [entry.debtorId, entry.creditorId]),
      );
      if (
        [...participants].some((userId) => groupBalance(entries, userId) !== 0n)
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "All balances must be zero before deleting the group",
        });
      }

      return ctx.db.transaction(async (tx) => {
        const expenseRecords = await tx
          .select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.groupId, input.groupId));
        const settlementRecords = await tx
          .select({ id: settlements.id })
          .from(settlements)
          .where(eq(settlements.groupId, input.groupId));
        const expenseIds = expenseRecords.map(({ id }) => id);
        const settlementIds = settlementRecords.map(({ id }) => id);
        const entryIds = entries.map(({ id }) => id);

        if (entryIds.length > 0) {
          await tx
            .delete(ledgerValuations)
            .where(inArray(ledgerValuations.ledgerEntryId, entryIds));
        }
        await tx
          .delete(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.contextType, "group"),
              eq(ledgerEntries.contextId, input.groupId),
            ),
          );

        if (expenseIds.length > 0) {
          await tx
            .delete(expensePayments)
            .where(inArray(expensePayments.expenseId, expenseIds));
          await tx
            .delete(expenseSplits)
            .where(inArray(expenseSplits.expenseId, expenseIds));
          await tx
            .delete(rateSnapshots)
            .where(inArray(rateSnapshots.expenseId, expenseIds));
          await tx
            .delete(financialRevisions)
            .where(
              and(
                eq(financialRevisions.recordType, "expense"),
                inArray(financialRevisions.recordId, expenseIds),
              ),
            );
        }
        if (settlementIds.length > 0) {
          await tx
            .delete(rateSnapshots)
            .where(inArray(rateSnapshots.settlementId, settlementIds));
          await tx
            .delete(financialRevisions)
            .where(
              and(
                eq(financialRevisions.recordType, "settlement"),
                inArray(financialRevisions.recordId, settlementIds),
              ),
            );
        }

        await tx.delete(expenses).where(eq(expenses.groupId, input.groupId));
        await tx
          .delete(settlements)
          .where(eq(settlements.groupId, input.groupId));
        await tx.delete(invites).where(eq(invites.groupId, input.groupId));
        await tx
          .delete(groupMembers)
          .where(eq(groupMembers.groupId, input.groupId));
        const [deleted] = await tx
          .delete(groups)
          .where(
            and(
              eq(groups.id, input.groupId),
              eq(groups.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!deleted) throw new TRPCError({ code: "CONFLICT" });
        return { deleted: true };
      });
    }),
});
