import {
  and,
  eq,
  expensePayments,
  expenses,
  expenseSplits,
  financialRevisions,
  groupMembers,
  groups,
  gte,
  inArray,
  invites,
  isNull,
  ledgerEntries,
  ledgerValuations,
  lte,
  or,
  profiles,
  rateSnapshots,
  settlements,
  sql,
} from "@splidly/db";
import {
  convertMinor,
  type CurrencyCode,
  currencyCodeSchema,
  customImageDataUrlSchema,
  groupColorPresets,
  groupColorSchema,
  groupIconKeySchema,
  money,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  memberRepaymentSummaries,
  repaymentPlan,
  type LedgerAmount,
  viewerRepaymentBalances,
} from "../domain/debt-simplification";
import { expenseActivitySummary } from "../domain/expense-activity";
import { allocateByUser } from "../domain/expense-allocation";
import {
  buildGroupStatistics,
  resolveGroupStatisticsIconKey,
  statisticsBucketForPeriod,
} from "../domain/group-statistics";
import {
  assertGroupOwner,
  groupBy,
  requireActiveGroupMember,
  requireGroupOwner,
} from "../domain/helpers";
import { loadGroupedLedgerAmounts } from "../domain/ledger-summary";
import { protectedProcedure, router } from "../trpc";

function groupBalance(
  entries: LedgerAmount[],
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
  if (userId !== ctx.session.user.id) {
    await requireGroupOwner(ctx.db, groupId, ctx.session.user.id);
  }
  const [entries, active]: [
    (typeof ledgerEntries.$inferSelect)[],
    (typeof groupMembers.$inferSelect)[],
  ] = await Promise.all([
    ctx.db
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
      ),
    ctx.db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)),
      ),
  ]);
  if (groupBalance(entries, userId) !== 0n) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Member balance must be zero",
    });
  }
  if (active.length <= 1) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The final member must archive the group",
    });
  }
  const [group] = await ctx.db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) throw new TRPCError({ code: "NOT_FOUND" });
  if (group.createdBy === userId) {
    const successor = active
      .filter((member) => member.userId !== userId)
      .sort(
        (left, right) => left.joinedAt.getTime() - right.joinedAt.getTime(),
      )[0];
    if (!successor) throw new TRPCError({ code: "PRECONDITION_FAILED" });
    await ctx.db
      .update(groups)
      .set({
        createdBy: successor.userId,
        updatedAt: new Date(),
        version: sql`${groups.version} + 1`,
      })
      .where(eq(groups.id, groupId));
  }
  await ctx.db
    .update(groupMembers)
    .set({ removedAt: new Date() })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
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
    const groupIds = memberships.map(({ group }) => group.id);
    if (groupIds.length === 0) return [];
    const [allEntries, allMembers] = await Promise.all([
      loadGroupedLedgerAmounts(ctx.db, "group", groupIds),
      ctx.db
        .select({
          groupId: groupMembers.groupId,
          userId: groupMembers.userId,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(groupMembers)
        .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
        .where(
          and(
            inArray(groupMembers.groupId, groupIds),
            isNull(groupMembers.removedAt),
          ),
        ),
    ]);
    const entriesByGroup = groupBy(allEntries, (entry) => entry.contextId);
    const membersByGroup = groupBy(allMembers, (member) => member.groupId);

    return memberships.map(({ group }) => {
      const entries = entriesByGroup.get(group.id) ?? [];
      const members = membersByGroup.get(group.id) ?? [];
      const membersById = new Map(
        members.map((member) => [member.userId, member]),
      );
      const transfers = repaymentPlan(entries, group.simplifyDebts);
      const memberBalances = viewerRepaymentBalances(
        transfers,
        members,
        ctx.session.user.id,
      ).map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl:
          membersById.get(member.userId)?.avatarUrl ?? null,
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
    });
  }),

  balances: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ group: groups })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.session.user.id),
            isNull(groupMembers.removedAt),
          ),
        )
        .limit(1);
      const group = membership?.group;
      if (!group) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a group member",
        });
      }
      if (group.archivedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const [members, entries] = await Promise.all([
        ctx.db
          .select({
            userId: groupMembers.userId,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
          })
          .from(groupMembers)
          .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
          .where(
            and(
              eq(groupMembers.groupId, input.groupId),
              isNull(groupMembers.removedAt),
            ),
          ),
        loadGroupedLedgerAmounts(ctx.db, "group", [input.groupId]),
      ]);
      const transfers = repaymentPlan(entries, group.simplifyDebts);
      const currency = group.currency as CurrencyCode;

      return {
        group: {
          id: group.id,
          name: group.name,
          currency,
          simplifyDebts: group.simplifyDebts,
        },
        members: memberRepaymentSummaries(transfers, members).map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          isViewer: member.userId === ctx.session.user.id,
          owes: money(currency, member.owesMinor),
          lent: money(currency, member.lentMinor),
          relationships: member.relationships.map((relationship) => ({
            kind: relationship.kind,
            counterpartyId: relationship.counterpartyId,
            counterpartyDisplayName: relationship.counterpartyDisplayName,
            counterpartyAvatarUrl: relationship.counterpartyAvatarUrl,
            amount: money(currency, relationship.amountMinor),
          })),
        })),
      };
    }),

  statistics: protectedProcedure
    .input(
      z
        .object({
          groupId: z.uuid(),
          range: z
            .enum(["all", "12-months", "30-days", "custom"])
            .default("all"),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .superRefine((value, context) => {
          if (value.range !== "custom") return;
          if (!value.from) {
            context.addIssue({
              code: "custom",
              path: ["from"],
              message: "A custom range needs a start date",
            });
          }
          if (!value.to) {
            context.addIssue({
              code: "custom",
              path: ["to"],
              message: "A custom range needs an end date",
            });
          }
          if (value.from && value.to && value.from > value.to) {
            context.addIssue({
              code: "custom",
              path: ["to"],
              message: "The end date must be on or after the start date",
            });
          }
        }),
    )
    .query(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ group: groups })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.session.user.id),
            isNull(groupMembers.removedAt),
          ),
        )
        .limit(1);
      const group = membership?.group;
      if (!group || group.archivedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const now = new Date();
      let requestedFrom: Date | undefined;
      let requestedTo: Date | undefined;
      if (input.range === "30-days") {
        requestedFrom = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 29,
          ),
        );
        requestedTo = now;
      }
      if (input.range === "12-months") {
        requestedFrom = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
        );
        requestedTo = now;
      }
      if (input.range === "custom") {
        requestedFrom = input.from!;
        requestedTo = input.to!;
      }
      const expenseConditions = [
        eq(expenses.groupId, input.groupId),
        isNull(expenses.deletedAt),
      ];
      if (requestedFrom) {
        expenseConditions.push(gte(expenses.occurredAt, requestedFrom));
      }
      if (requestedTo) {
        expenseConditions.push(lte(expenses.occurredAt, requestedTo));
      }

      const [members, expenseRecords] = await Promise.all([
        ctx.db
          .select({
            userId: groupMembers.userId,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            homeCurrency: profiles.homeCurrency,
          })
          .from(groupMembers)
          .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
          .where(eq(groupMembers.groupId, input.groupId)),
        ctx.db
          .select()
          .from(expenses)
          .where(and(...expenseConditions))
          .orderBy(expenses.occurredAt),
      ]);
      const expenseIds = expenseRecords.map((expense) => expense.id);
      const rangeStart =
        requestedFrom ?? expenseRecords[0]?.occurredAt ?? requestedTo ?? now;
      const rangeEnd =
        requestedTo ?? expenseRecords.at(-1)?.occurredAt ?? requestedFrom ?? now;
      const timelineBucket = statisticsBucketForPeriod(rangeStart, rangeEnd);
      const [paymentRecords, splitRecords, rateRecords] =
        expenseIds.length === 0
          ? [[], [], []]
          : await Promise.all([
              ctx.db
                .select()
                .from(expensePayments)
                .where(inArray(expensePayments.expenseId, expenseIds)),
              ctx.db
                .select()
                .from(expenseSplits)
                .where(inArray(expenseSplits.expenseId, expenseIds)),
              ctx.db
                .select({
                  expenseId: rateSnapshots.expenseId,
                  base: rateSnapshots.base,
                  quote: rateSnapshots.quote,
                  rate: rateSnapshots.rate,
                })
                .from(rateSnapshots)
                .where(inArray(rateSnapshots.expenseId, expenseIds)),
            ]);
      const paymentsByExpense = groupBy(
        paymentRecords,
        (payment) => payment.expenseId,
      );
      const splitsByExpense = groupBy(
        splitRecords,
        (split) => split.expenseId,
      );
      const ratesByExpense = groupBy(
        rateRecords,
        (rate) => rate.expenseId ?? "",
      );
      let unconvertedExpenseCount = 0;
      const canonicalCurrency = group.currency as CurrencyCode;
      const membersById = new Map(
        members.map((member) => [member.userId, member]),
      );
      const statisticsExpenses = expenseRecords.flatMap((expense) => {
        const sourceCurrency = expense.sourceCurrency as CurrencyCode;
        const rates = ratesByExpense.get(expense.id) ?? [];
        const rate = rates.find(
          (candidate) =>
            candidate.base === sourceCurrency &&
            candidate.quote === canonicalCurrency,
        );
        if (sourceCurrency !== canonicalCurrency && !rate) {
          unconvertedExpenseCount += 1;
          return [];
        }
        const canonicalAmountMinor =
          sourceCurrency === canonicalCurrency
            ? expense.sourceAmountMinor
            : convertMinor(
                expense.sourceAmountMinor,
                sourceCurrency,
                canonicalCurrency,
                rate!.rate,
              );
        const sourcePayments = new Map(
          (paymentsByExpense.get(expense.id) ?? []).map((payment) => [
            payment.userId,
            payment.sourceAmountMinor,
          ]),
        );
        if (sourcePayments.size === 0) {
          sourcePayments.set(expense.payerId, expense.sourceAmountMinor);
        }
        const sourceShares = new Map(
          (splitsByExpense.get(expense.id) ?? []).map((split) => [
            split.userId,
            split.sourceAmountMinor,
          ]),
        );
        if (sourceShares.size === 0) {
          unconvertedExpenseCount += 1;
          return [];
        }
        return [
          {
            id: expense.id,
            description: expense.description,
            iconKey: resolveGroupStatisticsIconKey(expense),
            occurredAt: expense.occurredAt,
            sourceCurrency,
            sourceAmountMinor: expense.sourceAmountMinor,
            sourcePayments,
            sourceShares,
            rates,
            canonicalAmountMinor,
            canonicalPayments: allocateByUser(
              canonicalAmountMinor,
              sourcePayments,
            ),
            canonicalShares: allocateByUser(
              canonicalAmountMinor,
              sourceShares,
            ),
          },
        ];
      });
      const statistics = buildGroupStatistics({
        expenses: statisticsExpenses,
        members,
        viewerUserId: ctx.session.user.id,
        bucket: timelineBucket,
      });
      const asMoney = (amountMinor: bigint) =>
        money(canonicalCurrency, amountMinor);
      const homeMoney = (
        expense: (typeof statisticsExpenses)[number],
        userId: string,
        sourceAmountMinor: bigint,
      ) => {
        const homeCurrency = membersById.get(userId)
          ?.homeCurrency as CurrencyCode | undefined;
        if (!homeCurrency) return undefined;
        if (homeCurrency === expense.sourceCurrency) {
          return money(homeCurrency, sourceAmountMinor);
        }
        const rate = expense.rates.find(
          (candidate) =>
            candidate.base === expense.sourceCurrency &&
            candidate.quote === homeCurrency,
        );
        if (!rate) return undefined;
        return money(
          homeCurrency,
          convertMinor(
            sourceAmountMinor,
            expense.sourceCurrency,
            homeCurrency,
            rate.rate,
          ),
        );
      };

      return {
        group: {
          id: group.id,
          name: group.name,
          color: group.color,
          currency: canonicalCurrency,
        },
        range: input.range,
        rangeStart,
        rangeEnd,
        timelineBucket,
        unconvertedExpenseCount,
        totalSpent: asMoney(statistics.totalSpentMinor),
        viewerPaid: asMoney(statistics.viewerPaidMinor),
        viewerShare: asMoney(statistics.viewerShareMinor),
        expenseCount: statistics.expenseCount,
        categories: statistics.categories.map((category) => ({
          iconKey: category.iconKey,
          amount: asMoney(category.amountMinor),
        })),
        timeline: statistics.timeline.map((point) => ({
          period: point.period,
          amount: asMoney(point.amountMinor),
        })),
        members: statistics.members.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          homeCurrency: membersById.get(member.userId)!
            .homeCurrency as CurrencyCode,
          isViewer: member.isViewer,
          paid: asMoney(member.paidMinor),
          share: asMoney(member.shareMinor),
        })),
        expenses: [...statisticsExpenses].reverse().map((expense) => ({
          id: expense.id,
          description: expense.description,
          iconKey: expense.iconKey,
          occurredAt: expense.occurredAt,
          amount: asMoney(expense.canonicalAmountMinor),
          sourceAmount: money(
            expense.sourceCurrency,
            expense.sourceAmountMinor,
          ),
          payments: [...expense.canonicalPayments].map(
            ([userId, amountMinor]) => {
              const sourceAmountMinor =
                expense.sourcePayments.get(userId) ?? 0n;
              return {
                userId,
                amount: asMoney(amountMinor),
                sourceAmount: money(
                  expense.sourceCurrency,
                  sourceAmountMinor,
                ),
                homeAmount: homeMoney(expense, userId, sourceAmountMinor),
              };
            },
          ),
          shares: [...expense.canonicalShares].map(
            ([userId, amountMinor]) => {
              const sourceAmountMinor = expense.sourceShares.get(userId) ?? 0n;
              return {
                userId,
                amount: asMoney(amountMinor),
                sourceAmount: money(
                  expense.sourceCurrency,
                  sourceAmountMinor,
                ),
                homeAmount: homeMoney(expense, userId, sourceAmountMinor),
              };
            },
          ),
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        iconKey: groupIconKeySchema.default("default"),
        color: groupColorSchema.optional(),
        imageUrl: customImageDataUrlSchema.nullable().optional(),
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
            imageUrl: input.imageUrl,
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
      const [membership] = await ctx.db
        .select({ group: groups })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.session.user.id),
            isNull(groupMembers.removedAt),
          ),
        )
        .limit(1);
      const group = membership?.group;
      if (!group) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a group member",
        });
      }
      if (group.archivedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [members, activity, settlementRecords, groupEntries] =
        await Promise.all([
          ctx.db
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
            ),
          ctx.db
            .select()
            .from(expenses)
            .where(
              and(
                eq(expenses.groupId, input.groupId),
                isNull(expenses.deletedAt),
              ),
            )
            .orderBy(expenses.occurredAt),
          ctx.db
            .select({
              id: settlements.id,
              createdBy: settlements.createdBy,
              occurredAt: settlements.occurredAt,
              createdAt: settlements.createdAt,
              version: settlements.version,
              notes: settlements.notes,
              fromUserId: settlements.fromUserId,
              toUserId: settlements.toUserId,
              sourceCurrency: settlements.sourceCurrency,
              sourceAmountMinor: settlements.sourceAmountMinor,
            })
            .from(settlements)
            .where(
              and(
                eq(settlements.groupId, input.groupId),
                isNull(settlements.deletedAt),
              ),
            )
            .orderBy(settlements.occurredAt),
          loadGroupedLedgerAmounts(ctx.db, "group", [group.id]),
        ]);
      const settlementUserIds = [
        ...new Set(
          settlementRecords.flatMap((settlement) => [
            settlement.fromUserId,
            settlement.toUserId,
          ]),
        ),
      ];
      const settlementProfiles =
        settlementUserIds.length === 0
          ? []
          : await ctx.db
              .select({
                userId: profiles.userId,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
              })
              .from(profiles)
              .where(inArray(profiles.userId, settlementUserIds));
      const settlementProfilesById = new Map(
        settlementProfiles.map((profile) => [profile.userId, profile]),
      );
      const activityIds = activity.map((expense) => expense.id);
      const [activityRates, activityPayments, viewerSplits, legacyPayers] =
        activity.length === 0
          ? [[], [], [], []]
          : await Promise.all([
              ctx.db
                .select({
                  expenseId: rateSnapshots.expenseId,
                  base: rateSnapshots.base,
                  quote: rateSnapshots.quote,
                  rate: rateSnapshots.rate,
                })
                .from(rateSnapshots)
                .where(inArray(rateSnapshots.expenseId, activityIds)),
              ctx.db
                .select({
                  expenseId: expensePayments.expenseId,
                  userId: expensePayments.userId,
                  sourceAmountMinor: expensePayments.sourceAmountMinor,
                  displayName: profiles.displayName,
                })
                .from(expensePayments)
                .innerJoin(
                  profiles,
                  eq(profiles.userId, expensePayments.userId),
                )
                .where(inArray(expensePayments.expenseId, activityIds)),
              ctx.db
                .select({
                  expenseId: expenseSplits.expenseId,
                  sourceAmountMinor: expenseSplits.sourceAmountMinor,
                })
                .from(expenseSplits)
                .where(
                  and(
                    inArray(expenseSplits.expenseId, activityIds),
                    eq(expenseSplits.userId, ctx.session.user.id),
                  ),
                ),
              ctx.db
                .select({
                  userId: profiles.userId,
                  displayName: profiles.displayName,
                })
                .from(profiles)
                .where(
                  inArray(profiles.userId, [
                    ...new Set(activity.map((expense) => expense.payerId)),
                  ]),
                ),
            ]);
      const activityPaymentsByExpense = new Map<
        string,
        (typeof activityPayments)[number][]
      >();
      for (const payment of activityPayments) {
        const payments = activityPaymentsByExpense.get(payment.expenseId) ?? [];
        payments.push(payment);
        activityPaymentsByExpense.set(payment.expenseId, payments);
      }
      const activityRatesByExpense = groupBy(
        activityRates,
        (rate) => rate.expenseId ?? "",
      );
      const viewerSplitsByExpense = new Map(
        viewerSplits.map((split) => [split.expenseId, split]),
      );
      const legacyPayersById = new Map(
        legacyPayers.map((profile) => [profile.userId, profile]),
      );
      const membersById = new Map(
        members.map((member) => [member.userId, member]),
      );
      const transfers = repaymentPlan(groupEntries, group.simplifyDebts);
      const memberBalances = viewerRepaymentBalances(
        transfers,
        members,
        ctx.session.user.id,
      ).map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl: membersById.get(member.userId)?.avatarUrl ?? null,
        balance: money(group.currency, member.amountMinor),
      }));
      const balanceMembers = memberRepaymentSummaries(transfers, members).map(
        (member) => ({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          isViewer: member.userId === ctx.session.user.id,
          owes: money(group.currency, member.owesMinor),
          lent: money(group.currency, member.lentMinor),
          relationships: member.relationships.map((relationship) => ({
            kind: relationship.kind,
            counterpartyId: relationship.counterpartyId,
            counterpartyDisplayName: relationship.counterpartyDisplayName,
            counterpartyAvatarUrl: relationship.counterpartyAvatarUrl,
            amount: money(group.currency, relationship.amountMinor),
          })),
        }),
      );
      const expenseActivity = activity.reverse().map((expense) => {
        const sourceCurrency = expense.sourceCurrency as CurrencyCode;
        const canonicalCurrency = group.currency as CurrencyCode;
        const rate = (activityRatesByExpense.get(expense.id) ?? []).find(
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

        const summary = expenseActivitySummary({
          sourceCurrency,
          sourceAmountMinor: expense.sourceAmountMinor,
          legacyPayerId: expense.payerId,
          legacyPayerDisplayName: legacyPayersById.get(expense.payerId)
            ?.displayName,
          payments: activityPaymentsByExpense.get(expense.id) ?? [],
          viewerUserId: ctx.session.user.id,
          viewerShareMinor: viewerSplitsByExpense.get(expense.id)
            ?.sourceAmountMinor,
        });

        const viewerInvolvement = {
          ...summary.viewerInvolvement,
          amount:
            sourceCurrency === canonicalCurrency
              ? summary.viewerInvolvement.amount
              : rate
                ? money(
                    canonicalCurrency,
                    convertMinor(
                      BigInt(summary.viewerInvolvement.amount.minor),
                      sourceCurrency,
                      canonicalCurrency,
                      rate.rate,
                    ),
                  )
                : summary.viewerInvolvement.amount,
        };

        return {
          ...expense,
          canonicalAmount,
          ...summary,
          viewerInvolvement,
        };
      });
      const settlementActivity = settlementRecords
        .reverse()
        .map((settlement) => {
          const fromProfile = settlementProfilesById.get(settlement.fromUserId);
          const toProfile = settlementProfilesById.get(settlement.toUserId);
          return {
            id: settlement.id,
            canEdit: settlement.createdBy === ctx.session.user.id,
            occurredAt: settlement.occurredAt,
            createdAt: settlement.createdAt,
            version: settlement.version,
            notes: settlement.notes,
            amount: money(
              settlement.sourceCurrency as CurrencyCode,
              settlement.sourceAmountMinor,
            ),
            from: {
              userId: settlement.fromUserId,
              displayName: fromProfile?.displayName ?? "Unknown member",
              avatarUrl: fromProfile?.avatarUrl ?? null,
              isViewer: settlement.fromUserId === ctx.session.user.id,
            },
            to: {
              userId: settlement.toUserId,
              displayName: toProfile?.displayName ?? "Unknown member",
              avatarUrl: toProfile?.avatarUrl ?? null,
              isViewer: settlement.toUserId === ctx.session.user.id,
            },
          };
        });
      return {
        group,
        members,
        memberBalances,
        balanceMembers,
        expenses: expenseActivity,
        settlements: settlementActivity,
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
        imageUrl: customImageDataUrlSchema.nullable().optional(),
        currency: currencyCodeSchema,
        simplifyDebts: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ group: groups })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.session.user.id),
            isNull(groupMembers.removedAt),
          ),
        )
        .limit(1);
      const current = membership?.group;
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      assertGroupOwner(current.createdBy, ctx.session.user.id);
      if (current.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT" });
      }
      if (current.currency !== input.currency) {
        const [expenseRecords, settlementRecords] = await Promise.all([
          ctx.db
            .select({ id: expenses.id })
            .from(expenses)
            .where(eq(expenses.groupId, input.groupId))
            .limit(1),
          ctx.db
            .select({ id: settlements.id })
            .from(settlements)
            .where(eq(settlements.groupId, input.groupId))
            .limit(1),
        ]);
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
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          currency: input.currency,
          simplifyDebts: input.simplifyDebts,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(groups.id, input.groupId),
            eq(groups.version, input.expectedVersion),
            eq(groups.createdBy, ctx.session.user.id),
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
      await requireGroupOwner(ctx.db, input.groupId, ctx.session.user.id);
      const entries = await loadGroupedLedgerAmounts(ctx.db, "group", [
        input.groupId,
      ]);
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
            eq(groups.createdBy, ctx.session.user.id),
          ),
        )
        .returning();
      if (!archived) throw new TRPCError({ code: "CONFLICT" });
      return archived;
    }),

  delete: protectedProcedure
    .input(z.object({ groupId: z.uuid(), expectedVersion: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ group: groups })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.session.user.id),
            isNull(groupMembers.removedAt),
          ),
        )
        .limit(1);
      const group = membership?.group;
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
