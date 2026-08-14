import {
  and,
  type Database,
  eq,
  financialRevisions,
  groupMembers,
  groups,
  inArray,
  isNull,
  ledgerEntries,
  ledgerValuations,
  profiles,
  rateSnapshots,
  settlements,
} from "@splidly/db";
import {
  type CurrencyCode,
  rateSnapshotSchema,
  settlementMutationSchema,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  convertWithRates,
  loadHomeCurrencies,
  resolveRates,
  reverseActiveEntries,
} from "../domain/finance";
import {
  requireActiveGroupMember,
  requireFriendshipParticipant,
} from "../domain/helpers";
import { protectedProcedure, router } from "../trpc";

export function assertSettlementParticipant(
  actorId: string,
  fromUserId: string,
  toUserId: string,
) {
  if (actorId === fromUserId || actorId === toUserId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Only the people involved can record this settlement",
  });
}

async function requireSettlementGroup(input: {
  db: Database;
  groupId: string;
  actorId: string;
  fromUserId: string;
  toUserId: string;
  canonicalCurrency: string;
}) {
  const rows = await input.db
    .select({ group: groups, userId: groupMembers.userId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(
        eq(groupMembers.groupId, input.groupId),
        isNull(groupMembers.removedAt),
      ),
    );
  const group = rows[0]?.group;
  if (!group) throw new TRPCError({ code: "NOT_FOUND" });
  if (!rows.some((row) => row.userId === input.actorId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a group member" });
  }
  if (group.currency !== input.canonicalCurrency) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Settlement must clear the group currency",
    });
  }
  const participantIds = new Set(rows.map((row) => row.userId));
  if (
    !participantIds.has(input.fromUserId) ||
    !participantIds.has(input.toUserId)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Settlement users must be active members",
    });
  }
  return group;
}

export const settlementsRouter = router({
  detail: protectedProcedure
    .input(z.object({ settlementId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [settlement] = await ctx.db
        .select()
        .from(settlements)
        .where(
          and(
            eq(settlements.id, input.settlementId),
            isNull(settlements.deletedAt),
          ),
        )
        .limit(1);
      if (!settlement) throw new TRPCError({ code: "NOT_FOUND" });
      if (settlement.groupId) {
        await requireActiveGroupMember(
          ctx.db,
          settlement.groupId,
          ctx.session.user.id,
        );
      } else if (settlement.friendshipId) {
        await requireFriendshipParticipant(
          ctx.db,
          settlement.friendshipId,
          ctx.session.user.id,
        );
      } else {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      const [people, storedRates] = await Promise.all([
        ctx.db
          .select({
            userId: profiles.userId,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            homeCurrency: profiles.homeCurrency,
          })
          .from(profiles)
          .where(
            inArray(profiles.userId, [
              settlement.fromUserId,
              settlement.toUserId,
            ]),
          ),
        ctx.db
          .select()
          .from(rateSnapshots)
          .where(eq(rateSnapshots.settlementId, settlement.id)),
      ]);
      return {
        settlement,
        from: people.find((person) => person.userId === settlement.fromUserId),
        to: people.find((person) => person.userId === settlement.toUserId),
        rates: storedRates.map((rate) =>
          rateSnapshotSchema.parse({
            base: rate.base,
            quote: rate.quote,
            rate: rate.rate,
            provider: rate.provider,
            providerDate: rate.providerDate,
            source: rate.source,
          }),
        ),
      };
    }),

  create: protectedProcedure
    .input(settlementMutationSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.fromUserId === input.toUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A settlement requires two people",
        });
      }
      const [duplicate] = await ctx.db
        .select()
        .from(settlements)
        .where(
          and(
            eq(settlements.createdBy, ctx.session.user.id),
            eq(settlements.clientMutationId, input.clientMutationId),
          ),
        )
        .limit(1);
      if (duplicate) return duplicate;

      let contextId: string;
      if (input.context.type === "group") {
        const group = await requireSettlementGroup({
          db: ctx.db,
          groupId: input.context.groupId,
          actorId: ctx.session.user.id,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          canonicalCurrency: input.canonicalCurrency,
        });
        contextId = group.id;
      } else {
        assertSettlementParticipant(
          ctx.session.user.id,
          input.fromUserId,
          input.toUserId,
        );
        const friendship = await requireFriendshipParticipant(
          ctx.db,
          input.context.friendshipId,
          ctx.session.user.id,
        );
        const pair = [friendship.userLowId, friendship.userHighId];
        if (
          !pair.includes(input.fromUserId) ||
          !pair.includes(input.toUserId)
        ) {
          throw new TRPCError({ code: "BAD_REQUEST" });
        }
        contextId = friendship.id;
      }

      const homeCurrencies = await loadHomeCurrencies(ctx.db, [
        input.fromUserId,
        input.toUserId,
      ]);
      const rates = await resolveRates({
        db: ctx.db,
        userId: ctx.session.user.id,
        base: input.amount.currency,
        targets: [
          input.canonicalCurrency,
          ...homeCurrencies.values(),
        ] as CurrencyCode[],
        quoteId: input.quoteId,
        overrides: input.rateOverrides,
      });
      const canonicalAmount = convertWithRates(
        BigInt(input.amount.minor),
        input.amount.currency,
        input.canonicalCurrency,
        rates,
      );
      // A payment is a ledger fact, not a capped repayment action. It may
      // reduce, clear, or reverse the current net balance between two people.

      return ctx.db.transaction(async (tx) => {
        const [settlement] = await tx
          .insert(settlements)
          .values({
            contextType: input.context.type,
            groupId:
              input.context.type === "group" ? input.context.groupId : null,
            friendshipId:
              input.context.type === "friend"
                ? input.context.friendshipId
                : null,
            createdBy: ctx.session.user.id,
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            occurredAt: new Date(input.occurredAt),
            notes: input.notes,
            sourceCurrency: input.amount.currency,
            sourceAmountMinor: BigInt(input.amount.minor),
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount,
            clientMutationId: input.clientMutationId,
          })
          .onConflictDoNothing({
            target: [settlements.createdBy, settlements.clientMutationId],
          })
          .returning();
        if (!settlement) {
          const [duplicate] = await tx
            .select()
            .from(settlements)
            .where(
              and(
                eq(settlements.createdBy, ctx.session.user.id),
                eq(settlements.clientMutationId, input.clientMutationId),
              ),
            )
            .limit(1);
          if (duplicate) return duplicate;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        await tx.insert(rateSnapshots).values(
          rates.map((rate) => ({
            settlementId: settlement.id,
            base: rate.base,
            quote: rate.quote,
            rate: rate.rate,
            provider: rate.provider,
            providerDate: rate.providerDate,
            source: rate.source,
          })),
        );
        const [entry] = await tx
          .insert(ledgerEntries)
          .values({
            sourceType: "settlement",
            sourceId: settlement.id,
            contextType: input.context.type,
            contextId,
            debtorId: input.toUserId,
            creditorId: input.fromUserId,
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount,
          })
          .returning();
        if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const fromCurrency = homeCurrencies.get(input.fromUserId);
        const toCurrency = homeCurrencies.get(input.toUserId);
        if (!fromCurrency || !toCurrency) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        await tx.insert(ledgerValuations).values([
          {
            ledgerEntryId: entry.id,
            userId: input.fromUserId,
            currency: fromCurrency,
            amountMinor: convertWithRates(
              BigInt(input.amount.minor),
              input.amount.currency,
              fromCurrency,
              rates,
            ),
          },
          {
            ledgerEntryId: entry.id,
            userId: input.toUserId,
            currency: toCurrency,
            amountMinor: convertWithRates(
              BigInt(input.amount.minor),
              input.amount.currency,
              toCurrency,
              rates,
            ),
          },
        ]);
        await tx.insert(financialRevisions).values({
          recordType: "settlement",
          recordId: settlement.id,
          version: 1,
          action: "create",
          actorId: ctx.session.user.id,
          snapshot: {
            context: input.context,
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            amount: input.amount,
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount.toString(),
            occurredAt: input.occurredAt,
            notes: input.notes,
            rates,
          },
        });
        return settlement;
      });
    }),

  update: protectedProcedure
    .input(
      settlementMutationSchema.and(
        z.object({
          settlementId: z.uuid(),
          expectedVersion: z.number().int().positive(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromUserId === input.toUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A settlement requires two people",
        });
      }
      const [current] = await ctx.db
        .select()
        .from(settlements)
        .where(eq(settlements.id, input.settlementId))
        .limit(1);
      if (!current || current.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (current.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT" });
      }
      if (
        current.contextType !== input.context.type ||
        (input.context.type === "group" &&
          current.groupId !== input.context.groupId) ||
        (input.context.type === "friend" &&
          current.friendshipId !== input.context.friendshipId)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A settlement cannot be moved to a different ledger",
        });
      }

      let contextId: string;
      if (input.context.type === "group") {
        const group = await requireSettlementGroup({
          db: ctx.db,
          groupId: input.context.groupId,
          actorId: ctx.session.user.id,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          canonicalCurrency: input.canonicalCurrency,
        });
        contextId = group.id;
      } else {
        assertSettlementParticipant(
          ctx.session.user.id,
          input.fromUserId,
          input.toUserId,
        );
        const friendship = await requireFriendshipParticipant(
          ctx.db,
          input.context.friendshipId,
          ctx.session.user.id,
        );
        const pair = [friendship.userLowId, friendship.userHighId];
        if (
          !pair.includes(input.fromUserId) ||
          !pair.includes(input.toUserId)
        ) {
          throw new TRPCError({ code: "BAD_REQUEST" });
        }
        contextId = friendship.id;
      }

      const existingRates = await ctx.db
        .select()
        .from(rateSnapshots)
        .where(eq(rateSnapshots.settlementId, current.id));
      const fallbackRates = existingRates.map((rate) =>
        rateSnapshotSchema.parse({
          base: rate.base,
          quote: rate.quote,
          rate: rate.rate,
          provider: rate.provider,
          providerDate: rate.providerDate,
          source: rate.source,
        }),
      );
      const homeCurrencies = await loadHomeCurrencies(ctx.db, [
        input.fromUserId,
        input.toUserId,
      ]);
      const rates = await resolveRates({
        db: ctx.db,
        userId: ctx.session.user.id,
        base: input.amount.currency,
        targets: [
          input.canonicalCurrency,
          ...homeCurrencies.values(),
        ] as CurrencyCode[],
        quoteId: input.quoteId,
        overrides: input.rateOverrides,
        fallbackRates,
      });
      const canonicalAmount = convertWithRates(
        BigInt(input.amount.minor),
        input.amount.currency,
        input.canonicalCurrency,
        rates,
      );

      return ctx.db.transaction(async (tx) => {
        await reverseActiveEntries(tx, "settlement", current.id);
        await tx
          .delete(rateSnapshots)
          .where(eq(rateSnapshots.settlementId, current.id));
        const [updated] = await tx
          .update(settlements)
          .set({
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            occurredAt: new Date(input.occurredAt),
            notes: input.notes,
            sourceCurrency: input.amount.currency,
            sourceAmountMinor: BigInt(input.amount.minor),
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount,
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(settlements.id, current.id),
              eq(settlements.version, current.version),
            ),
          )
          .returning();
        if (!updated) throw new TRPCError({ code: "CONFLICT" });
        await tx.insert(rateSnapshots).values(
          rates.map((rate) => ({
            settlementId: current.id,
            base: rate.base,
            quote: rate.quote,
            rate: rate.rate,
            provider: rate.provider,
            providerDate: rate.providerDate,
            source: rate.source,
          })),
        );
        const [entry] = await tx
          .insert(ledgerEntries)
          .values({
            sourceType: "settlement",
            sourceId: current.id,
            contextType: input.context.type,
            contextId,
            debtorId: input.toUserId,
            creditorId: input.fromUserId,
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount,
          })
          .returning();
        if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const fromCurrency = homeCurrencies.get(input.fromUserId);
        const toCurrency = homeCurrencies.get(input.toUserId);
        if (!fromCurrency || !toCurrency) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        await tx.insert(ledgerValuations).values([
          {
            ledgerEntryId: entry.id,
            userId: input.fromUserId,
            currency: fromCurrency,
            amountMinor: convertWithRates(
              BigInt(input.amount.minor),
              input.amount.currency,
              fromCurrency,
              rates,
            ),
          },
          {
            ledgerEntryId: entry.id,
            userId: input.toUserId,
            currency: toCurrency,
            amountMinor: convertWithRates(
              BigInt(input.amount.minor),
              input.amount.currency,
              toCurrency,
              rates,
            ),
          },
        ]);
        await tx.insert(financialRevisions).values({
          recordType: "settlement",
          recordId: current.id,
          version: updated.version,
          action: "update",
          actorId: ctx.session.user.id,
          snapshot: {
            context: input.context,
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            amount: input.amount,
            canonicalCurrency: input.canonicalCurrency,
            canonicalAmountMinor: canonicalAmount.toString(),
            occurredAt: input.occurredAt,
            notes: input.notes,
            rates,
          },
        });
        return updated;
      });
    }),

  remove: protectedProcedure
    .input(
      z.object({
        settlementId: z.uuid(),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(settlements)
        .where(eq(settlements.id, input.settlementId))
        .limit(1);
      if (!current || current.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (current.groupId) {
        await requireActiveGroupMember(
          ctx.db,
          current.groupId,
          ctx.session.user.id,
        );
      } else if (current.friendshipId) {
        await requireFriendshipParticipant(
          ctx.db,
          current.friendshipId,
          ctx.session.user.id,
        );
      }
      return ctx.db.transaction(async (tx) => {
        await reverseActiveEntries(tx, "settlement", current.id);
        const [removed] = await tx
          .update(settlements)
          .set({
            deletedAt: new Date(),
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(settlements.id, current.id),
              eq(settlements.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!removed) throw new TRPCError({ code: "CONFLICT" });
        await tx.insert(financialRevisions).values({
          recordType: "settlement",
          recordId: current.id,
          version: removed.version,
          action: "delete",
          actorId: ctx.session.user.id,
          snapshot: { deletedAt: removed.deletedAt?.toISOString() },
        });
        return removed;
      });
    }),
});
