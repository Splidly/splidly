import {
  and,
  eq,
  expenses,
  friendships,
  groupMembers,
  groups,
  isNull,
  ledgerEntries,
  ledgerValuations,
  or,
  profiles,
} from "@splidly/db";
import { money, type CurrencyCode } from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  repaymentPlan,
  type RepaymentTransfer,
} from "../domain/debt-simplification";
import {
  requireFriendshipParticipant,
} from "../domain/helpers";
import { protectedProcedure, router } from "../trpc";

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await ctx.db
      .select()
      .from(friendships)
      .where(
        and(
          or(
            eq(friendships.userLowId, userId),
            eq(friendships.userHighId, userId),
          ),
          isNull(friendships.removedAt),
        ),
      );

    const simplifiedMemberships = await ctx.db
      .select({ group: groups })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(
        and(
          eq(groupMembers.userId, userId),
          isNull(groupMembers.removedAt),
          isNull(groups.archivedAt),
          eq(groups.simplifyDebts, true),
        ),
      );
    const simplifiedGroups = new Map<
      string,
      { currency: string; transfers: RepaymentTransfer[] }
    >();
    await Promise.all(
      simplifiedMemberships.map(async ({ group }) => {
        const entries = await ctx.db
          .select()
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.contextType, "group"),
              eq(ledgerEntries.contextId, group.id),
            ),
          );
        simplifiedGroups.set(group.id, {
          currency: group.currency,
          transfers: repaymentPlan(entries, true),
        });
      }),
    );

    return Promise.all(
      rows.map(async (friendship) => {
        const friendId =
          friendship.userLowId === userId
            ? friendship.userHighId
            : friendship.userLowId;
        const [friend] = await ctx.db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, friendId))
          .limit(1);
        const entries = await ctx.db
          .select()
          .from(ledgerEntries)
          .where(
            or(
              and(
                eq(ledgerEntries.debtorId, userId),
                eq(ledgerEntries.creditorId, friendId),
              ),
              and(
                eq(ledgerEntries.debtorId, friendId),
                eq(ledgerEntries.creditorId, userId),
              ),
            ),
          );
        const buckets = new Map<
          string,
          {
            contextId: string;
            contextType: "group" | "friend";
            viewerCurrency: string;
            friendCurrency: string;
            canonicalCurrency: string;
            canonicalMinor: bigint;
            viewerMinor: bigint;
            friendMinor: bigint;
          }
        >();
        for (const entry of entries) {
          if (
            entry.contextType === "group" &&
            simplifiedGroups.has(entry.contextId)
          ) {
            continue;
          }
          const values = await ctx.db
            .select()
            .from(ledgerValuations)
            .where(eq(ledgerValuations.ledgerEntryId, entry.id));
          const viewer = values.find((value) => value.userId === userId);
          const counterpart = values.find((value) => value.userId === friendId);
          if (!viewer || !counterpart) continue;
          const key = `${entry.contextType}:${entry.contextId}:${entry.canonicalCurrency}:${viewer.currency}:${counterpart.currency}`;
          const existing = buckets.get(key) ?? {
            contextId: entry.contextId,
            contextType: entry.contextType as "group" | "friend",
            viewerCurrency: viewer.currency,
            friendCurrency: counterpart.currency,
            canonicalCurrency: entry.canonicalCurrency,
            canonicalMinor: 0n,
            viewerMinor: 0n,
            friendMinor: 0n,
          };
          const sign = entry.creditorId === userId ? 1n : -1n;
          existing.viewerMinor += sign * viewer.amountMinor;
          existing.friendMinor += sign * counterpart.amountMinor;
          existing.canonicalMinor += sign * entry.canonicalAmountMinor;
          buckets.set(key, existing);
        }
        for (const [groupId, plan] of simplifiedGroups) {
          const canonicalMinor = plan.transfers.reduce(
            (sum, transfer) => {
              if (
                transfer.fromUserId === friendId &&
                transfer.toUserId === userId
              ) {
                return sum + transfer.amountMinor;
              }
              if (
                transfer.fromUserId === userId &&
                transfer.toUserId === friendId
              ) {
                return sum - transfer.amountMinor;
              }
              return sum;
            },
            0n,
          );
          if (canonicalMinor === 0n) continue;
          const key = `group:${groupId}:${plan.currency}:${plan.currency}:${plan.currency}`;
          buckets.set(key, {
            contextId: groupId,
            contextType: "group",
            viewerCurrency: plan.currency,
            friendCurrency: plan.currency,
            canonicalCurrency: plan.currency,
            canonicalMinor,
            viewerMinor: canonicalMinor,
            friendMinor: canonicalMinor,
          });
        }

        return {
          friendship,
          friend,
          balances: [...buckets.values()]
            .filter((bucket) => bucket.viewerMinor !== 0n)
            .map((bucket) => ({
              contextId: bucket.contextId,
              contextType: bucket.contextType,
              viewerAmount: money(
                bucket.viewerCurrency,
                bucket.viewerMinor,
              ),
              counterpartyAmount: money(
                bucket.friendCurrency,
                bucket.friendMinor,
              ),
              canonicalAmount: money(
                bucket.canonicalCurrency,
                bucket.canonicalMinor,
              ),
            })),
        };
      }),
    );
  }),

  detail: protectedProcedure
    .input(z.object({ friendshipId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const friendship = await requireFriendshipParticipant(
        ctx.db,
        input.friendshipId,
        ctx.session.user.id,
      );
      const friendId =
        friendship.userLowId === ctx.session.user.id
          ? friendship.userHighId
          : friendship.userLowId;
      const [friend] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, friendId))
        .limit(1);
      const activity = await ctx.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.friendshipId, friendship.id),
            isNull(expenses.deletedAt),
          ),
        )
        .orderBy(expenses.occurredAt);
      return {
        friendship,
        friend,
        expenses: activity.reverse().map((expense) => ({
          ...expense,
          canonicalAmount: money(
            expense.sourceCurrency as CurrencyCode,
            expense.sourceAmountMinor,
          ),
        })),
      };
    }),

  remove: protectedProcedure
    .input(z.object({ friendshipId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const friendship = await requireFriendshipParticipant(
        ctx.db,
        input.friendshipId,
        ctx.session.user.id,
      );
      const entries = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.contextType, "friend"),
            eq(ledgerEntries.contextId, friendship.id),
          ),
        );
      const balances = new Map<string, bigint>();
      for (const entry of entries) {
        const signed =
          entry.creditorId === ctx.session.user.id
            ? entry.canonicalAmountMinor
            : entry.debtorId === ctx.session.user.id
              ? -entry.canonicalAmountMinor
              : 0n;
        balances.set(
          entry.canonicalCurrency,
          (balances.get(entry.canonicalCurrency) ?? 0n) + signed,
        );
      }
      if ([...balances.values()].some((net) => net !== 0n)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Settle the direct balance before unfriending",
        });
      }
      await ctx.db
        .update(friendships)
        .set({ removedAt: new Date(), updatedAt: new Date() })
        .where(eq(friendships.id, friendship.id));
      return { removed: true };
    }),
});
