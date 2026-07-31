import {
  accounts,
  and,
  eq,
  groupMembers,
  groups,
  inArray,
  invites,
  isNull,
  ledgerEntries,
  or,
  profiles,
  pushInstallations,
  sessions,
  sql,
  users,
} from "@splidly/db";
import { currencyCodeSchema } from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireProfile } from "../domain/helpers";
import { protectedProcedure, router } from "../trpc";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) =>
    requireProfile(ctx.db, ctx.session.user),
  ),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().trim().min(1).max(80),
        avatarUrl: z.string().url().nullable().optional(),
        homeCurrency: currencyCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProfile(ctx.db, ctx.session.user);
      const [profile] = await ctx.db
        .update(profiles)
        .set({
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          homeCurrency: input.homeCurrency,
          onboardedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(profiles.userId, ctx.session.user.id),
            isNull(profiles.deletedAt),
          ),
        )
        .returning();
      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile no longer exists",
        });
      }
      return profile;
    }),

  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE"),
        leaveGroups: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tombstone = `deleted-${crypto.randomUUID()}@invalid.splidly`;
      return ctx.db.transaction(async (tx) => {
        const activeMemberships = await tx
          .select({ groupId: groupMembers.groupId })
          .from(groupMembers)
          .innerJoin(groups, eq(groups.id, groupMembers.groupId))
          .where(
            and(
              eq(groupMembers.userId, userId),
              isNull(groupMembers.removedAt),
              isNull(groups.archivedAt),
            ),
          );
        if (activeMemberships.length > 0 && !input.leaveGroups) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Leave all groups before deleting your account",
          });
        }

        const entries = await tx
          .select()
          .from(ledgerEntries)
          .where(
            or(
              eq(ledgerEntries.debtorId, userId),
              eq(ledgerEntries.creditorId, userId),
            ),
          );
        const balances = new Map<string, bigint>();
        for (const entry of entries) {
          const key = `${entry.contextType}:${entry.contextId}:${entry.canonicalCurrency}`;
          const signed =
            entry.creditorId === userId
              ? entry.canonicalAmountMinor
              : -entry.canonicalAmountMinor;
          balances.set(key, (balances.get(key) ?? 0n) + signed);
        }
        if ([...balances.values()].some((amount) => amount !== 0n)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Settle all balances before deleting your account",
          });
        }

        const deletedAt = new Date();
        const activeGroupIds = activeMemberships.map(
          (membership) => membership.groupId,
        );
        if (input.leaveGroups && activeGroupIds.length > 0) {
          const groupMemberships = await tx
            .select({
              groupId: groupMembers.groupId,
              userId: groupMembers.userId,
            })
            .from(groupMembers)
            .where(
              and(
                inArray(groupMembers.groupId, activeGroupIds),
                isNull(groupMembers.removedAt),
              ),
            );
          const groupsWithOtherMembers = new Set(
            groupMemberships
              .filter((membership) => membership.userId !== userId)
              .map((membership) => membership.groupId),
          );
          const groupsToArchive = activeGroupIds.filter(
            (groupId) => !groupsWithOtherMembers.has(groupId),
          );
          if (groupsToArchive.length > 0) {
            await tx
              .update(groups)
              .set({
                archivedAt: deletedAt,
                updatedAt: deletedAt,
                version: sql`${groups.version} + 1`,
              })
              .where(inArray(groups.id, groupsToArchive));
          }
          await tx
            .update(groupMembers)
            .set({ removedAt: deletedAt })
            .where(
              and(
                eq(groupMembers.userId, userId),
                inArray(groupMembers.groupId, activeGroupIds),
                isNull(groupMembers.removedAt),
              ),
            );
        }

        await tx.delete(invites).where(eq(invites.inviterId, userId));
        await tx
          .delete(pushInstallations)
          .where(eq(pushInstallations.userId, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx
          .update(profiles)
          .set({
            displayName: "Deleted user",
            avatarUrl: null,
            onboardedAt: null,
            deletedAt,
            updatedAt: deletedAt,
          })
          .where(eq(profiles.userId, userId));
        await tx
          .update(users)
          .set({
            name: "Deleted user",
            email: tombstone,
            image: null,
            updatedAt: deletedAt,
          })
          .where(eq(users.id, userId));
        return { deleted: true };
      });
    }),
});
