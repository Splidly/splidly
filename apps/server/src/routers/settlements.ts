import {
  and,
  eq,
  financialRevisions,
  groupMembers,
  groups,
  isNull,
  ledgerEntries,
  ledgerValuations,
  rateSnapshots,
  settlements,
} from "@splidly/db";
import {
  settlementMutationSchema,
  type CurrencyCode,
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

export const settlementsRouter = router({
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
        await requireActiveGroupMember(
          ctx.db,
          input.context.groupId,
          ctx.session.user.id,
        );
        const [group] = await ctx.db
          .select()
          .from(groups)
          .where(eq(groups.id, input.context.groupId))
          .limit(1);
        if (!group) throw new TRPCError({ code: "NOT_FOUND" });
        if (group.currency !== input.canonicalCurrency) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Settlement must clear the group currency",
          });
        }
        const participants = await ctx.db
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.groupId, group.id),
              isNull(groupMembers.removedAt),
            ),
          );
        if (
          !participants.some((x) => x.userId === input.fromUserId) ||
          !participants.some((x) => x.userId === input.toUserId)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Settlement users must be active members",
          });
        }
        contextId = group.id;
      } else {
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
      const pairEntries = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.contextType, input.context.type),
            eq(ledgerEntries.contextId, contextId),
            eq(ledgerEntries.canonicalCurrency, input.canonicalCurrency),
          ),
        );
      const outstanding = pairEntries.reduce((sum, entry) => {
        if (
          entry.debtorId === input.fromUserId &&
          entry.creditorId === input.toUserId
        ) {
          return sum + entry.canonicalAmountMinor;
        }
        if (
          entry.debtorId === input.toUserId &&
          entry.creditorId === input.fromUserId
        ) {
          return sum - entry.canonicalAmountMinor;
        }
        return sum;
      }, 0n);
      if (outstanding <= 0n || canonicalAmount > outstanding) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Settlement exceeds the outstanding balance",
        });
      }

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
          .returning();
        if (!settlement) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
      if (!current || current.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
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

