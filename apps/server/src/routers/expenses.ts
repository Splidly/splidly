import {
  and,
  eq,
  expenseSplits,
  expenses,
  financialRevisions,
  groupMembers,
  groups,
  isNull,
  ledgerEntries,
  ledgerValuations,
  profiles,
  rateSnapshots,
} from "@splidly/db";
import {
  allocateByWeights,
  detectExpenseIconKey,
  expenseMutationSchema,
  rateSnapshotSchema,
  splitInputSchema,
  splitSourceAmount,
  type CurrencyCode,
  type ExpenseIconKey,
  type ExpenseMutation,
  type RateSnapshot,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  convertWithRates,
  loadHomeCurrencies,
  resolveRates,
  reverseActiveEntries,
  type DbTransaction,
} from "../domain/finance";
import {
  requireActiveGroupMember,
  requireFriendshipParticipant,
} from "../domain/helpers";
import {
  protectedProcedure,
  router,
  type TrpcContext,
} from "../trpc";

interface PreparedExpense {
  input: ExpenseMutation;
  iconKey: ExpenseIconKey;
  iconManuallySet: boolean;
  contextId: string;
  canonicalCurrency: CurrencyCode;
  sourceShares: Map<string, bigint>;
  canonicalShares: Map<string, bigint>;
  homeCurrencies: Map<string, CurrencyCode>;
  rates: Awaited<ReturnType<typeof resolveRates>>;
}

async function prepareExpense(
  ctx: TrpcContext,
  input: ExpenseMutation,
  fallbackRates: RateSnapshot[] = [],
): Promise<PreparedExpense> {
  const userId = ctx.session?.user.id;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const participantIds =
    input.split.mode === "equal"
      ? input.split.participantIds
      : input.split.shares.map((share) => share.userId);
  const involvedIds = [...new Set([...participantIds, input.payerId])];

  let contextId: string;
  let canonicalCurrency: CurrencyCode;
  let allowedIds: string[];
  if (input.context.type === "group") {
    await requireActiveGroupMember(ctx.db, input.context.groupId, userId);
    const [group] = await ctx.db
      .select()
      .from(groups)
      .where(eq(groups.id, input.context.groupId))
      .limit(1);
    if (!group || group.archivedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
    }
    const members = await ctx.db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          isNull(groupMembers.removedAt),
        ),
      );
    allowedIds = members.map((member) => member.userId);
    contextId = group.id;
    canonicalCurrency = group.currency as CurrencyCode;
  } else {
    const friendship = await requireFriendshipParticipant(
      ctx.db,
      input.context.friendshipId,
      userId,
    );
    contextId = friendship.id;
    canonicalCurrency = input.amount.currency;
    allowedIds = [friendship.userLowId, friendship.userHighId];
  }
  if (involvedIds.some((id) => !allowedIds.includes(id))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payer and participants must belong to this ledger",
    });
  }

  const sourceAmount = BigInt(input.amount.minor);
  const sourceShares = splitSourceAmount(sourceAmount, input.split);
  const homeCurrencies = await loadHomeCurrencies(ctx.db, involvedIds);
  const targets = [
    canonicalCurrency,
    ...homeCurrencies.values(),
  ] as CurrencyCode[];
  const rates = await resolveRates({
    db: ctx.db,
    userId,
    base: input.amount.currency,
    targets,
    quoteId: input.quoteId,
    overrides: input.rateOverrides,
    fallbackRates,
  });
  const canonicalTotal = convertWithRates(
    sourceAmount,
    input.amount.currency,
    canonicalCurrency,
    rates,
  );
  const sourceEntries = [...sourceShares.entries()];
  const canonicalAmounts = allocateByWeights(
    canonicalTotal,
    sourceEntries.map(([, value]) => value),
  );
  const canonicalShares = new Map(
    sourceEntries.map(([id], index) => [
      id,
      canonicalAmounts[index] ?? 0n,
    ]),
  );
  const manualIconKey = input.iconManuallySet ? input.iconKey : undefined;

  return {
    input,
    iconKey: manualIconKey ?? detectExpenseIconKey(input.description),
    iconManuallySet: manualIconKey !== undefined,
    contextId,
    canonicalCurrency,
    sourceShares,
    canonicalShares,
    homeCurrencies,
    rates,
  };
}

async function writeExpenseFinancials(
  tx: DbTransaction,
  expenseId: string,
  prepared: PreparedExpense,
) {
  await tx.insert(expenseSplits).values(
    [...prepared.sourceShares].map(([userId, sourceAmountMinor]) => ({
      expenseId,
      userId,
      sourceAmountMinor,
    })),
  );
  await tx.insert(rateSnapshots).values(
    prepared.rates.map((rate) => ({
      expenseId,
      base: rate.base,
      quote: rate.quote,
      rate: rate.rate,
      provider: rate.provider,
      providerDate: rate.providerDate,
      source: rate.source,
    })),
  );

  for (const [participantId, sourceShare] of prepared.sourceShares) {
    if (participantId === prepared.input.payerId || sourceShare === 0n) continue;
    const canonicalAmount = prepared.canonicalShares.get(participantId) ?? 0n;
    const [entry] = await tx
      .insert(ledgerEntries)
      .values({
        sourceType: "expense",
        sourceId: expenseId,
        contextType: prepared.input.context.type,
        contextId: prepared.contextId,
        debtorId: participantId,
        creditorId: prepared.input.payerId,
        canonicalCurrency: prepared.canonicalCurrency,
        canonicalAmountMinor: canonicalAmount,
      })
      .returning();
    if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const debtorCurrency = prepared.homeCurrencies.get(participantId);
    const creditorCurrency = prepared.homeCurrencies.get(
      prepared.input.payerId,
    );
    if (!debtorCurrency || !creditorCurrency) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }
    await tx.insert(ledgerValuations).values([
      {
        ledgerEntryId: entry.id,
        userId: participantId,
        currency: debtorCurrency,
        amountMinor: convertWithRates(
          sourceShare,
          prepared.input.amount.currency,
          debtorCurrency,
          prepared.rates,
        ),
      },
      {
        ledgerEntryId: entry.id,
        userId: prepared.input.payerId,
        currency: creditorCurrency,
        amountMinor: convertWithRates(
          sourceShare,
          prepared.input.amount.currency,
          creditorCurrency,
          prepared.rates,
        ),
      },
    ]);
  }
}

function revisionSnapshot(prepared: PreparedExpense) {
  return {
    context: prepared.input.context,
    description: prepared.input.description,
    iconKey: prepared.iconKey,
    iconManuallySet: prepared.iconManuallySet,
    notes: prepared.input.notes,
    occurredAt: prepared.input.occurredAt,
    payerId: prepared.input.payerId,
    amount: prepared.input.amount,
    split: prepared.input.split,
    rates: prepared.rates,
  };
}

export const expensesRouter = router({
  detail: protectedProcedure
    .input(z.object({ expenseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [expense] = await ctx.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.id, input.expenseId),
            isNull(expenses.deletedAt),
          ),
        )
        .limit(1);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });

      if (expense.groupId) {
        await requireActiveGroupMember(
          ctx.db,
          expense.groupId,
          ctx.session.user.id,
        );
      } else if (expense.friendshipId) {
        await requireFriendshipParticipant(
          ctx.db,
          expense.friendshipId,
          ctx.session.user.id,
        );
      } else {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      const splitRows = await ctx.db
        .select({
          userId: expenseSplits.userId,
          sourceAmountMinor: expenseSplits.sourceAmountMinor,
          displayName: profiles.displayName,
          homeCurrency: profiles.homeCurrency,
        })
        .from(expenseSplits)
        .innerJoin(profiles, eq(profiles.userId, expenseSplits.userId))
        .where(eq(expenseSplits.expenseId, expense.id));
      const [payer] = await ctx.db
        .select({
          userId: profiles.userId,
          displayName: profiles.displayName,
          homeCurrency: profiles.homeCurrency,
        })
        .from(profiles)
        .where(eq(profiles.userId, expense.payerId))
        .limit(1);
      const storedRates = await ctx.db
        .select()
        .from(rateSnapshots)
        .where(eq(rateSnapshots.expenseId, expense.id));
      const rates = storedRates.map((rate) =>
        rateSnapshotSchema.parse({
          base: rate.base,
          quote: rate.quote,
          rate: rate.rate,
          provider: rate.provider,
          providerDate: rate.providerDate,
          source: rate.source,
        }),
      );
      const [revision] = await ctx.db
        .select({ snapshot: financialRevisions.snapshot })
        .from(financialRevisions)
        .where(
          and(
            eq(financialRevisions.recordType, "expense"),
            eq(financialRevisions.recordId, expense.id),
            eq(financialRevisions.version, expense.version),
          ),
        )
        .limit(1);
      const storedSplit = splitInputSchema.safeParse(
        revision?.snapshot["split"],
      );

      return {
        expense,
        payer: payer ?? null,
        splits: splitRows,
        rates,
        split: storedSplit.success
          ? storedSplit.data
          : {
              mode: "exact" as const,
              shares: splitRows.map((row) => ({
                userId: row.userId,
                amountMinor: row.sourceAmountMinor.toString(),
              })),
            },
      };
    }),

  create: protectedProcedure
    .input(expenseMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const [duplicate] = await ctx.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.createdBy, ctx.session.user.id),
            eq(expenses.clientMutationId, input.clientMutationId),
          ),
        )
        .limit(1);
      if (duplicate) return duplicate;
      const prepared = await prepareExpense(ctx, input);
      return ctx.db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(expenses)
          .values({
            contextType: input.context.type,
            groupId:
              input.context.type === "group" ? input.context.groupId : null,
            friendshipId:
              input.context.type === "friend"
                ? input.context.friendshipId
                : null,
            createdBy: ctx.session.user.id,
            payerId: input.payerId,
            description: input.description,
            iconKey: prepared.iconKey,
            iconManuallySet: prepared.iconManuallySet,
            notes: input.notes,
            occurredAt: new Date(input.occurredAt),
            sourceCurrency: input.amount.currency,
            sourceAmountMinor: BigInt(input.amount.minor),
            clientMutationId: input.clientMutationId,
          })
          .returning();
        if (!expense) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await writeExpenseFinancials(tx, expense.id, prepared);
        await tx.insert(financialRevisions).values({
          recordType: "expense",
          recordId: expense.id,
          version: 1,
          action: "create",
          actorId: ctx.session.user.id,
          snapshot: revisionSnapshot(prepared),
        });
        return expense;
      });
    }),

  update: protectedProcedure
    .input(
      expenseMutationSchema.extend({
        expenseId: z.uuid(),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(expenses)
        .where(eq(expenses.id, input.expenseId))
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
          message: "An expense cannot be moved to a different ledger",
        });
      }
      const existingRates = await ctx.db
        .select()
        .from(rateSnapshots)
        .where(eq(rateSnapshots.expenseId, current.id));
      const prepared = await prepareExpense(
        ctx,
        input,
        existingRates.map((rate) =>
          rateSnapshotSchema.parse({
            base: rate.base,
            quote: rate.quote,
            rate: rate.rate,
            provider: rate.provider,
            providerDate: rate.providerDate,
            source: rate.source,
          }),
        ),
      );
      return ctx.db.transaction(async (tx) => {
        await reverseActiveEntries(tx, "expense", current.id);
        await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, current.id));
        await tx.delete(rateSnapshots).where(eq(rateSnapshots.expenseId, current.id));
        const [updated] = await tx
          .update(expenses)
          .set({
            contextType: input.context.type,
            groupId:
              input.context.type === "group" ? input.context.groupId : null,
            friendshipId:
              input.context.type === "friend"
                ? input.context.friendshipId
                : null,
            payerId: input.payerId,
            description: input.description,
            iconKey: prepared.iconKey,
            iconManuallySet: prepared.iconManuallySet,
            notes: input.notes,
            occurredAt: new Date(input.occurredAt),
            sourceCurrency: input.amount.currency,
            sourceAmountMinor: BigInt(input.amount.minor),
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(expenses.id, current.id),
              eq(expenses.version, current.version),
            ),
          )
          .returning();
        if (!updated) throw new TRPCError({ code: "CONFLICT" });
        await writeExpenseFinancials(tx, current.id, prepared);
        await tx.insert(financialRevisions).values({
          recordType: "expense",
          recordId: current.id,
          version: updated.version,
          action: "update",
          actorId: ctx.session.user.id,
          snapshot: revisionSnapshot(prepared),
        });
        return updated;
      });
    }),

  remove: protectedProcedure
    .input(
      z.object({
        expenseId: z.uuid(),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(expenses)
        .where(eq(expenses.id, input.expenseId))
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
        await reverseActiveEntries(tx, "expense", current.id);
        const [removed] = await tx
          .update(expenses)
          .set({
            deletedAt: new Date(),
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(expenses.id, current.id),
              eq(expenses.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!removed) throw new TRPCError({ code: "CONFLICT" });
        await tx.insert(financialRevisions).values({
          recordType: "expense",
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
