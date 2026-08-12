import { expenseIconKeys, type ExpenseIconKey, type Money } from "@splidly/shared";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { View } from "react-native";
import { ActivityTimeline } from "../../../../components/activity-timeline";
import {
  statisticsCategoryLabel,
  type GroupStatisticsData,
  type StatisticsRange,
} from "../../../../components/group-statistics";
import { ExpenseIcon } from "../../../../components/expense-icon";
import {
  EmptyState,
  ErrorState,
  Intro,
  ListRow,
  LoadingState,
  Screen,
  Section,
} from "../../../../components/ui";
import { groupActivityByDate } from "../../../../lib/activity-dates";
import { formatConvertedMoney } from "../../../../lib/money-display";
import { api } from "../../../../lib/trpc";

function isStatisticsRange(value: unknown): value is StatisticsRange {
  return value === "all" || value === "12-months" || value === "30-days";
}

function isExpenseIconKey(value: unknown): value is ExpenseIconKey {
  return (
    typeof value === "string" &&
    (expenseIconKeys as readonly string[]).includes(value)
  );
}

function formatted(money: Money) {
  return formatConvertedMoney(BigInt(money.minor), money.currency);
}

export default function StatisticsExpensesScreen() {
  const params = useLocalSearchParams<{
    id: string;
    range?: string;
    filter?: string;
    category?: string;
    userId?: string;
    metric?: string;
  }>();
  const range = isStatisticsRange(params.range) ? params.range : "all";
  const statistics = api.groups.statistics.useQuery({
    groupId: params.id,
    range,
  });

  if (statistics.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (statistics.error || !statistics.data) {
    return (
      <Screen>
        <ErrorState
          message={statistics.error?.message ?? "Unable to load expenses."}
        />
      </Screen>
    );
  }

  const data = statistics.data as GroupStatisticsData;
  const category = isExpenseIconKey(params.category)
    ? params.category
    : undefined;
  const metric = params.metric === "paid" ? "paid" : "share";
  const member = data.members.find((candidate) => candidate.userId === params.userId);
  const isMemberFilter = params.filter === "member" && Boolean(member);
  const title = isMemberFilter
    ? `${member!.isViewer ? "You" : member!.displayName} · ${metric === "paid" ? "Paid" : "Share"}`
    : category
      ? statisticsCategoryLabel(category)
      : "Expenses";
  const filteredExpenses = data.expenses.flatMap((expense) => {
    if (!isMemberFilter) {
      return !category || expense.iconKey === category
        ? [{ ...expense, displayedAmount: expense.amount }]
        : [];
    }
    const allocations = metric === "paid" ? expense.payments : expense.shares;
    const allocation = allocations.find(
      (candidate) => candidate.userId === member!.userId,
    );
    return allocation && BigInt(allocation.amount.minor) > 0n
      ? [{ ...expense, displayedAmount: allocation.amount }]
      : [];
  });
  const totalMinor = filteredExpenses.reduce(
    (sum, expense) => sum + BigInt(expense.displayedAmount.minor),
    0n,
  );
  const total = formatConvertedMoney(totalMinor, data.group.currency);
  const activityGroups = groupActivityByDate(filteredExpenses);
  const memberAmountExplanation = isMemberFilter
    ? metric === "share"
      ? `Amounts on the right show ${member!.isViewer ? "your" : `${member!.displayName}’s`} share, not the full expense total.`
      : `Amounts on the right show ${member!.isViewer ? "what you paid" : `what ${member!.displayName} paid`}, not the full expense total.`
    : undefined;

  return (
    <>
      <Screen
        refreshing={statistics.isRefetching}
        onRefresh={() => void statistics.refetch()}
      >
        {filteredExpenses.length === 0 ? (
          <Section>
            <EmptyState
              title="No matching expenses"
              message="There are no expenses for this selection and period."
            />
          </Section>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Intro>
                {filteredExpenses.length}{" "}
                {filteredExpenses.length === 1 ? "expense" : "expenses"} · {total}
              </Intro>
              {memberAmountExplanation ? (
                <Intro>{memberAmountExplanation}</Intro>
              ) : null}
            </View>
            <ActivityTimeline
              groups={activityGroups}
              getItemKey={(expense) => expense.id}
              renderItem={(expense) => (
                <ListRow
                  title={expense.description}
                  subtitle={
                    isMemberFilter
                      ? metric === "paid"
                        ? "Paid"
                        : "Share"
                      : statisticsCategoryLabel(expense.iconKey)
                  }
                  value={formatted(expense.displayedAmount)}
                  leading={
                    <ExpenseIcon
                      iconKey={expense.iconKey}
                      name={expense.description}
                      useNameFallback={false}
                    />
                  }
                  onPress={() =>
                    router.push(`/expense/${expense.id}` as Href)
                  }
                />
              )}
            />
          </>
        )}
      </Screen>
      <Stack.Screen options={{ title }} />
    </>
  );
}
