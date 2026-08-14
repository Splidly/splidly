import {
  expenseIconKeys,
  normalizeExpenseIconKey,
  type ExpenseIconKey,
} from "@splidly/shared";

export type GroupStatisticsExpense = {
  id: string;
  description: string;
  iconKey: ExpenseIconKey;
  occurredAt: Date;
  canonicalAmountMinor: bigint;
  canonicalPayments: ReadonlyMap<string, bigint>;
  canonicalShares: ReadonlyMap<string, bigint>;
};

export type GroupStatisticsMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type StatisticsTimelineBucket = "day" | "week" | "month" | "year";

const dayMilliseconds = 24 * 60 * 60 * 1000;

export function statisticsBucketForPeriod(from: Date, to: Date) {
  const spanDays = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / dayMilliseconds) + 1,
  );
  if (spanDays <= 45) return "day" as const;
  if (spanDays <= 180) return "week" as const;
  if (spanDays <= 1_095) return "month" as const;
  return "year" as const;
}

export function resolveGroupStatisticsIconKey(expense: {
  iconKey: unknown;
  iconManuallySet: boolean;
  description: string;
}): ExpenseIconKey {
  if (
    expense.iconManuallySet &&
    typeof expense.iconKey === "string" &&
    (expenseIconKeys as readonly string[]).includes(expense.iconKey)
  ) {
    return expense.iconKey as ExpenseIconKey;
  }
  return normalizeExpenseIconKey(expense.iconKey, expense.description);
}

function increment<Key>(
  totals: Map<Key, bigint>,
  key: Key,
  amountMinor: bigint,
) {
  totals.set(key, (totals.get(key) ?? 0n) + amountMinor);
}

function utcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function utcWeekKey(date: Date) {
  const start = new Date(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return utcDayKey(start);
}

function utcYearKey(date: Date) {
  return date.toISOString().slice(0, 4);
}

function timelineKey(date: Date, bucket: StatisticsTimelineBucket) {
  switch (bucket) {
    case "day":
      return utcDayKey(date);
    case "week":
      return utcWeekKey(date);
    case "month":
      return utcMonthKey(date);
    case "year":
      return utcYearKey(date);
  }
}

export function buildGroupStatistics(input: {
  expenses: readonly GroupStatisticsExpense[];
  members: readonly GroupStatisticsMember[];
  viewerUserId: string;
  bucket: StatisticsTimelineBucket;
}) {
  let totalSpentMinor = 0n;
  const categoryTotals = new Map<ExpenseIconKey, bigint>();
  const timelineTotals = new Map<string, bigint>();
  const memberPaidTotals = new Map<string, bigint>();
  const memberShareTotals = new Map<string, bigint>();

  for (const expense of input.expenses) {
    totalSpentMinor += expense.canonicalAmountMinor;
    increment(categoryTotals, expense.iconKey, expense.canonicalAmountMinor);
    increment(
      timelineTotals,
      timelineKey(expense.occurredAt, input.bucket),
      expense.canonicalAmountMinor,
    );
    for (const [userId, amountMinor] of expense.canonicalPayments) {
      increment(memberPaidTotals, userId, amountMinor);
    }
    for (const [userId, amountMinor] of expense.canonicalShares) {
      increment(memberShareTotals, userId, amountMinor);
    }
  }

  const knownMembers = new Map(
    input.members.map((member) => [member.userId, member]),
  );
  const involvedUserIds = new Set([
    ...knownMembers.keys(),
    ...memberPaidTotals.keys(),
    ...memberShareTotals.keys(),
  ]);

  return {
    totalSpentMinor,
    viewerPaidMinor: memberPaidTotals.get(input.viewerUserId) ?? 0n,
    viewerShareMinor: memberShareTotals.get(input.viewerUserId) ?? 0n,
    expenseCount: input.expenses.length,
    categories: [...categoryTotals]
      .map(([iconKey, amountMinor]) => ({ iconKey, amountMinor }))
      .sort((left, right) =>
        left.amountMinor === right.amountMinor
          ? left.iconKey.localeCompare(right.iconKey)
          : left.amountMinor > right.amountMinor
            ? -1
            : 1,
      ),
    timeline: [...timelineTotals]
      .map(([period, amountMinor]) => ({ period, amountMinor }))
      .sort((left, right) => left.period.localeCompare(right.period)),
    members: [...involvedUserIds]
      .map((userId) => {
        const member = knownMembers.get(userId);
        return {
          userId,
          displayName: member?.displayName ?? "Former member",
          avatarUrl: member?.avatarUrl ?? null,
          isViewer: userId === input.viewerUserId,
          paidMinor: memberPaidTotals.get(userId) ?? 0n,
          shareMinor: memberShareTotals.get(userId) ?? 0n,
        };
      })
      .sort((left, right) => {
        const leftTotal = left.paidMinor + left.shareMinor;
        const rightTotal = right.paidMinor + right.shareMinor;
        if (leftTotal !== rightTotal) return leftTotal > rightTotal ? -1 : 1;
        return left.displayName.localeCompare(right.displayName);
      }),
  };
}
