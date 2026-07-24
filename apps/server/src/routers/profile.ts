import {
  accounts,
  and,
  eq,
  groupMembers,
  groups,
  invites,
  isNull,
  ledgerEntries,
  or,
  profiles,
  sessions,
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
    .input(z.object({ confirmation: z.literal("DELETE") }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const activeMemberships = await ctx.db
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
      if (activeMemberships.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Leave all groups before deleting your account",
        });
      }

      const entries = await ctx.db
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

      const tombstone = `deleted-${crypto.randomUUID()}@invalid.splidly`;
      await ctx.db.transaction(async (tx) => {
        await tx.delete(invites).where(eq(invites.inviterId, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx
          .update(profiles)
          .set({
            displayName: "Deleted user",
            avatarUrl: null,
            onboardedAt: null,
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
        await tx
          .update(users)
          .set({
            name: "Deleted user",
            email: tombstone,
            image: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });
      return { deleted: true };
    }),
});
