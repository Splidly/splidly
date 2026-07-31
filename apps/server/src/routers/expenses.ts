import {
  and,
  eq,
  expensePayments,
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
  allocateByUser,
  expenseTransfers,
} from "../domain/expense-allocation";
import {
  requireActiveGroupMember,
  requireFriendshipParticipant,
} from "../domain/helpers";
import {
  enqueueExpenseNotifications,
  loadExpenseParticipantIds,
} from "../domain/expense-notifications";
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
  payments: Map<string, bigint>;
  sourceShares: Map<string, bigint>;
  participantIds: string[];
  transfers: {
    debtorId: string;
    creditorId: string;
    canonicalAmountMinor: bigint;
    debtorHomeAmountMinor: bigint;
    creditorHomeAmountMinor: bigint;
  }[];
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
  const sourceAmount = BigInt(input.amount.minor);
  const paymentInputs =
    input.payments ??
    (input.payerId
      ? [{ userId: input.payerId, amountMinor: input.amount.minor }]
      : []);
  const payments = new Map(
    paymentInputs.map((payment) => [
      payment.userId,
      BigInt(payment.amountMinor),
    ]),
  );
  if (
    payments.size === 0 ||
    payments.size !== paymentInputs.length ||
    [...payments.values()].some((amount) => amount <= 0n) ||
    [...payments.values()].reduce((sum, amount) => sum + amount, 0n) !==
      sourceAmount
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payer amounts must add up to the expense total",
    });
  }
  let sourceShares: Map<string, bigint>;
  try {
    sourceShares = splitSourceAmount(sourceAmount, input.split);
  } catch (cause) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: cause instanceof Error ? cause.message : "Invalid expense split",
    });
  }
  const involvedIds = [
    ...new Set([...sourceShares.keys(), ...payments.keys()]),
  ];

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
  const canonicalPayments = allocateByUser(canonicalTotal, payments);
  const canonicalShares = allocateByUser(canonicalTotal, sourceShares);
  const transfers = expenseTransfers(
    canonicalPayments,
    canonicalShares,
  ).map((transfer) => ({
    debtorId: transfer.debtorId,
    creditorId: transfer.creditorId,
    canonicalAmountMinor: transfer.sourceAmountMinor,
    debtorHomeAmountMinor: 0n,
    creditorHomeAmountMinor: 0n,
  }));
  for (const involvedId of involvedIds) {
    const transferIndexes = transfers.flatMap((transfer, index) =>
      transfer.debtorId === involvedId || transfer.creditorId === involvedId
        ? [index]
        : [],
    );
    if (transferIndexes.length === 0) continue;
    const sourceNet =
      (payments.get(involvedId) ?? 0n) -
      (sourceShares.get(involvedId) ?? 0n);
    const homeCurrency = homeCurrencies.get(involvedId);
    if (!homeCurrency) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }
    const homeNet = convertWithRates(
      sourceNet < 0n ? -sourceNet : sourceNet,
      input.amount.currency,
      homeCurrency,
      rates,
    );
    const homeAmounts = allocateByWeights(
      homeNet,
      transferIndexes.map(
        (index) => transfers[index]?.canonicalAmountMinor ?? 0n,
      ),
    );
    transferIndexes.forEach((transferIndex, allocationIndex) => {
      const transfer = transfers[transferIndex];
      if (!transfer) return;
      const amount = homeAmounts[allocationIndex] ?? 0n;
      if (transfer.debtorId === involvedId) {
        transfer.debtorHomeAmountMinor = amount;
      } else {
        transfer.creditorHomeAmountMinor = amount;
      }
    });
  }
  const manualIconKey = input.iconManuallySet ? input.iconKey : undefined;

  return {
    input,
    iconKey: manualIconKey ?? detectExpenseIconKey(input.description),
    iconManuallySet: manualIconKey !== undefined,
    contextId,
    canonicalCurrency,
    payments,
    sourceShares,
    participantIds: involvedIds,
    transfers,
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
  await tx.insert(expensePayments).values(
    [...prepared.payments].map(([userId, sourceAmountMinor]) => ({
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

  for (const transfer of prepared.transfers) {
    const [entry] = await tx
      .insert(ledgerEntries)
      .values({
        sourceType: "expense",
        sourceId: expenseId,
        contextType: prepared.input.context.type,
        contextId: prepared.contextId,
        debtorId: transfer.debtorId,
        creditorId: transfer.creditorId,
        canonicalCurrency: prepared.canonicalCurrency,
        canonicalAmountMinor: transfer.canonicalAmountMinor,
      })
      .returning();
    if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const debtorCurrency = prepared.homeCurrencies.get(transfer.debtorId);
    const creditorCurrency = prepared.homeCurrencies.get(transfer.creditorId);
    if (!debtorCurrency || !creditorCurrency) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }
    await tx.insert(ledgerValuations).values([
      {
        ledgerEntryId: entry.id,
        userId: transfer.debtorId,
        currency: debtorCurrency,
        amountMinor: transfer.debtorHomeAmountMinor,
      },
      {
        ledgerEntryId: entry.id,
        userId: transfer.creditorId,
        currency: creditorCurrency,
        amountMinor: transfer.creditorHomeAmountMinor,
      },
    ]);
  }
}

function revisionSnapshot(prepared: PreparedExpense) {
  const primaryPayerId = prepared.payments.keys().next().value;
  return {
    context: prepared.input.context,
    description: prepared.input.description,
    iconKey: prepared.iconKey,
    iconManuallySet: prepared.iconManuallySet,
    notes: prepared.input.notes,
    occurredAt: prepared.input.occurredAt,
    payerId: primaryPayerId,
    payments: [...prepared.payments].map(([userId, amountMinor]) => ({
      userId,
      amountMinor: amountMinor.toString(),
    })),
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
          avatarUrl: profiles.avatarUrl,
          homeCurrency: profiles.homeCurrency,
        })
        .from(expenseSplits)
        .innerJoin(profiles, eq(profiles.userId, expenseSplits.userId))
        .where(eq(expenseSplits.expenseId, expense.id));
      const [payer] = await ctx.db
        .select({
          userId: profiles.userId,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          homeCurrency: profiles.homeCurrency,
        })
        .from(profiles)
        .where(eq(profiles.userId, expense.payerId))
        .limit(1);
      const paymentRows = await ctx.db
        .select({
          userId: expensePayments.userId,
          sourceAmountMinor: expensePayments.sourceAmountMinor,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          homeCurrency: profiles.homeCurrency,
        })
        .from(expensePayments)
        .innerJoin(profiles, eq(profiles.userId, expensePayments.userId))
        .where(eq(expensePayments.expenseId, expense.id));
      const payers =
        paymentRows.length > 0
          ? paymentRows
          : payer
            ? [
                {
                  ...payer,
                  sourceAmountMinor: expense.sourceAmountMinor,
                },
              ]
            : [];
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
        payers,
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
      const primaryPayerId = prepared.payments.keys().next().value;
      if (!primaryPayerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payer required" });
      }
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
            payerId: primaryPayerId,
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
        if (expense.groupId) {
          await enqueueExpenseNotifications(tx, {
            action: "create",
            actorId: ctx.session.user.id,
            description: expense.description,
            expenseId: expense.id,
            expenseVersion: expense.version,
            groupId: expense.groupId,
            participantIds: prepared.participantIds,
          });
        }
        return expense;
      });
    }),

  update: protectedProcedure
    .input(
      expenseMutationSchema.and(
        z.object({
          expenseId: z.uuid(),
          expectedVersion: z.number().int().positive(),
        }),
      ),
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
      const primaryPayerId = prepared.payments.keys().next().value;
      if (!primaryPayerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payer required" });
      }
      return ctx.db.transaction(async (tx) => {
        const previousParticipantIds = await loadExpenseParticipantIds(
          tx,
          current.id,
        );
        await reverseActiveEntries(tx, "expense", current.id);
        await tx
          .delete(expensePayments)
          .where(eq(expensePayments.expenseId, current.id));
        await tx
          .delete(expenseSplits)
          .where(eq(expenseSplits.expenseId, current.id));
        await tx
          .delete(rateSnapshots)
          .where(eq(rateSnapshots.expenseId, current.id));
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
            payerId: primaryPayerId,
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
        if (updated.groupId) {
          await enqueueExpenseNotifications(tx, {
            action: "update",
            actorId: ctx.session.user.id,
            description: updated.description,
            expenseId: updated.id,
            expenseVersion: updated.version,
            groupId: updated.groupId,
            previousParticipantIds,
            participantIds: prepared.participantIds,
          });
        }
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
        const participantIds = await loadExpenseParticipantIds(tx, current.id);
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
        if (removed.groupId) {
          await enqueueExpenseNotifications(tx, {
            action: "delete",
            actorId: ctx.session.user.id,
            description: removed.description,
            expenseId: removed.id,
            expenseVersion: removed.version,
            groupId: removed.groupId,
            participantIds,
          });
        }
        return removed;
      });
    }),
});
