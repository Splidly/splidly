import {
  and,
  eq,
  expenses,
  friendships,
  groupMembers,
  groups,
  inArray,
  isNull,
  ledgerEntries,
  ledgerValuations,
  or,
  profiles,
  settlements,
} from "@splidly/db";
import { type CurrencyCode, money } from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  repaymentPlan,
  type RepaymentTransfer,
} from "../domain/debt-simplification";
import { groupBy, requireFriendshipParticipant } from "../domain/helpers";
import { loadGroupedLedgerAmounts } from "../domain/ledger-summary";
import { protectedProcedure, router } from "../trpc";

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [rows, simplifiedMemberships] = await Promise.all([
      ctx.db
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
        ),
      ctx.db
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
        ),
    ]);
    if (rows.length === 0) return [];
    const friendIds = rows.map((friendship) =>
      friendship.userLowId === userId
        ? friendship.userHighId
        : friendship.userLowId,
    );
    const simplifiedGroupIds = simplifiedMemberships.map(
      ({ group }) => group.id,
    );
    const [friendProfiles, pairEntries, simplifiedEntries] = await Promise.all([
      ctx.db.select().from(profiles).where(inArray(profiles.userId, friendIds)),
      ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          or(
            and(
              eq(ledgerEntries.debtorId, userId),
              inArray(ledgerEntries.creditorId, friendIds),
            ),
            and(
              eq(ledgerEntries.creditorId, userId),
              inArray(ledgerEntries.debtorId, friendIds),
            ),
          ),
        ),
      simplifiedGroupIds.length === 0
        ? Promise.resolve([])
        : loadGroupedLedgerAmounts(ctx.db, "group", simplifiedGroupIds),
    ]);
    const simplifiedGroups = new Map<
      string,
      { currency: string; transfers: RepaymentTransfer[] }
    >();
    const simplifiedEntriesByGroup = groupBy(
      simplifiedEntries,
      (entry) => entry.contextId,
    );
    for (const { group } of simplifiedMemberships) {
      simplifiedGroups.set(group.id, {
        currency: group.currency,
        transfers: repaymentPlan(
          simplifiedEntriesByGroup.get(group.id) ?? [],
          true,
        ),
      });
    }
    const friendIdSet = new Set(friendIds);
    const relevantPairEntries = pairEntries.filter((entry) => {
      const counterpartId =
        entry.debtorId === userId ? entry.creditorId : entry.debtorId;
      return friendIdSet.has(counterpartId);
    });
    const valuedEntries = relevantPairEntries.filter(
      (entry) =>
        entry.contextType !== "group" || !simplifiedGroups.has(entry.contextId),
    );
    const valuations =
      valuedEntries.length === 0
        ? []
        : await ctx.db
            .select()
            .from(ledgerValuations)
            .where(
              inArray(
                ledgerValuations.ledgerEntryId,
                valuedEntries.map((entry) => entry.id),
              ),
            );
    const valuationsByEntry = groupBy(
      valuations,
      (valuation) => valuation.ledgerEntryId,
    );
    const profilesById = new Map(
      friendProfiles.map((profile) => [profile.userId, profile]),
    );
    const entriesByFriend = groupBy(relevantPairEntries, (entry) =>
      entry.debtorId === userId ? entry.creditorId : entry.debtorId,
    );

    return rows.map((friendship) => {
      const friendId =
        friendship.userLowId === userId
          ? friendship.userHighId
          : friendship.userLowId;
      const friend = profilesById.get(friendId);
      const entries = entriesByFriend.get(friendId) ?? [];
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
        const values = valuationsByEntry.get(entry.id) ?? [];
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
        const canonicalMinor = plan.transfers.reduce((sum, transfer) => {
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
        }, 0n);
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
            viewerAmount: money(bucket.viewerCurrency, bucket.viewerMinor),
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
    });
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
      const [friendRows, activity, settlementRecords, settlementProfiles] =
        await Promise.all([
          ctx.db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, friendId))
            .limit(1),
          ctx.db
            .select()
            .from(expenses)
            .where(
              and(
                eq(expenses.friendshipId, friendship.id),
                isNull(expenses.deletedAt),
              ),
            )
            .orderBy(expenses.occurredAt),
          ctx.db
            .select()
            .from(settlements)
            .where(
              and(
                eq(settlements.friendshipId, friendship.id),
                isNull(settlements.deletedAt),
              ),
            ),
          ctx.db
            .select({
              userId: profiles.userId,
              displayName: profiles.displayName,
              avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(
              inArray(profiles.userId, [
                friendship.userLowId,
                friendship.userHighId,
              ]),
            ),
        ]);
      const friend = friendRows[0];
      const settlementProfilesById = new Map(
        settlementProfiles.map((profile) => [profile.userId, profile]),
      );
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
        settlements: settlementRecords.map((settlement) => ({
          id: settlement.id,
          canEdit: settlement.createdBy === ctx.session.user.id,
          occurredAt: settlement.occurredAt,
          createdAt: settlement.createdAt,
          version: settlement.version,
          notes: settlement.notes,
          canonicalCurrency: settlement.canonicalCurrency,
          amount: money(
            settlement.sourceCurrency as CurrencyCode,
            settlement.sourceAmountMinor,
          ),
          from: {
            userId: settlement.fromUserId,
            displayName:
              settlementProfilesById.get(settlement.fromUserId)?.displayName ??
              "Unknown member",
            avatarUrl:
              settlementProfilesById.get(settlement.fromUserId)?.avatarUrl ??
              null,
            isViewer: settlement.fromUserId === ctx.session.user.id,
          },
          to: {
            userId: settlement.toUserId,
            displayName:
              settlementProfilesById.get(settlement.toUserId)?.displayName ??
              "Unknown member",
            avatarUrl:
              settlementProfilesById.get(settlement.toUserId)?.avatarUrl ??
              null,
            isViewer: settlement.toUserId === ctx.session.user.id,
          },
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
