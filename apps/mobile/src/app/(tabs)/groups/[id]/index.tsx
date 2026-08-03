import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { View, useColorScheme } from "react-native";
import { ActivityTimeline } from "../../../../components/activity-timeline";
import { normalizeGroupIconKey } from "../../../../components/group-icon";
import {
  GroupBalanceSummary,
  GroupSummaryHeader,
} from "../../../../components/group-summary-header";
import { ExpenseIcon } from "../../../../components/expense-icon";
import { ExpenseListInvolvement } from "../../../../components/expense-list-involvement";
import { SettlementActivityRow } from "../../../../components/settlement-activity-row";
import {
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  PrimaryButton,
  Screen,
  Section,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";
import { groupActivityByDate } from "../../../../lib/activity-dates";
import { expensePaymentSummary } from "../../../../lib/expense-activity";
import { groupBalanceLines } from "../../../../lib/group-balance-summary";
import { groupActionColorsFor } from "../../../../lib/group-colors";
import type { CurrencyCode } from "@splidly/shared";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const detail = api.groups.detail.useQuery({ groupId: id });
  if (detail.isPending) {
    return <Screen><LoadingState /></Screen>;
  }
  if (detail.error || !detail.data) {
    return <Screen><ErrorState message={detail.error?.message} /></Screen>;
  }
  const { group, members, memberBalances, expenses, settlements } = detail.data;
  const activity = [
    ...expenses.map((expense) => ({
      type: "expense" as const,
      occurredAt: expense.occurredAt,
      sortAt: expense.createdAt,
      record: expense,
    })),
    ...settlements.map((settlement) => ({
      type: "settlement" as const,
      occurredAt: settlement.occurredAt,
      sortAt: settlement.createdAt,
      record: settlement,
    })),
  ];
  const activityGroups = groupActivityByDate(activity);
  const balanceLines = groupBalanceLines(
    memberBalances,
    members.length,
    group.currency,
  );
  const actionColors = groupActionColorsFor(
    group.color,
    group.id,
    colorScheme,
  );
  const outstandingMinor = memberBalances.reduce((total, member) => {
    const minor = BigInt(member.balance.minor);
    return total + (minor < 0n ? -minor : minor);
  }, 0n);
  return (
    <>
      <Screen
        refreshing={detail.isRefetching}
        onRefresh={() => void detail.refetch()}
      >
        <GroupSummaryHeader
          iconKey={normalizeGroupIconKey(group.iconKey)}
          name={group.name}
          colorKey={group.id}
          color={group.color}
          imageUrl={group.imageUrl}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Add expense"
              backgroundColor={actionColors.primaryBackground}
              foregroundColor={actionColors.primaryForeground}
              onPress={() =>
                router.push({
                  pathname: "/expense/new",
                  params: { type: "group", id: group.id },
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Settle up"
              tone="secondary"
              backgroundColor={actionColors.secondaryBackground}
              foregroundColor={actionColors.secondaryForeground}
              onPress={() =>
                router.push({
                  pathname: "/settlement/group",
                  params: { id: group.id },
                })
              }
            />
          </View>
        </View>
        <GroupBalanceSummary
          lines={balanceLines}
          currency={group.currency as CurrencyCode}
          totalMinor={outstandingMinor}
        />
        {activity.length === 0 ? (
          <Section>
            <EmptyState
              title="No activity yet"
              message="Add the first shared cost."
            />
          </Section>
        ) : (
          <ActivityTimeline
            groups={activityGroups}
            getItemKey={(item) => `${item.type}:${item.record.id}`}
            renderItem={(item) => {
              if (item.type === "settlement") {
                return (
                  <SettlementActivityRow
                    settlement={item.record}
                    onPress={() =>
                      router.push({
                        pathname: "/settlement/new",
                        params: {
                          type: "group",
                          id: group.id,
                          canonicalCurrency: group.currency,
                          settlementId: item.record.id,
                        },
                      })
                    }
                  />
                );
              }
              const expense = item.record;
              return (
                <ListRow
                  title={expense.description}
                  subtitle={expensePaymentSummary(
                    expense.payers,
                    expense.paymentTotal,
                  )}
                  subtitleNumberOfLines={1}
                  trailing={
                    <ExpenseListInvolvement
                      kind={expense.viewerInvolvement.kind}
                      amount={expense.viewerInvolvement.amount}
                    />
                  }
                  leading={
                    <ExpenseIcon
                      iconKey={expense.iconKey}
                      name={expense.description}
                      useNameFallback={!expense.iconManuallySet}
                    />
                  }
                  onPress={() =>
                    router.push(`/expense/${expense.id}` as Href)
                  }
                />
              );
            }}
          />
        )}
      </Screen>
      <Stack.Screen
        options={{
          title: group.name,
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton
                label={`${group.name} settings`}
                glyph="⚙"
                onPress={() => router.push(`/groups/${group.id}/settings`)}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel={`${group.name} settings`}
          onPress={() => router.push(`/groups/${group.id}/settings`)}
        />
      </Stack.Toolbar>
    </>
  );
}
