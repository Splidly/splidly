import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { View, useColorScheme } from "react-native";
import {
  normalizeGroupIconKey,
} from "../../../../components/group-icon";
import {
  GroupBalanceSummary,
  GroupSummaryHeader,
} from "../../../../components/group-summary-header";
import { ExpenseIcon } from "../../../../components/expense-icon";
import { ExpenseListInvolvement } from "../../../../components/expense-list-involvement";
import {
  Avatar,
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";
import { expenseActivitySubtitle } from "../../../../lib/expense-activity";
import { groupBalanceLines } from "../../../../lib/group-balance-summary";
import { groupActionColorsFor } from "../../../../lib/group-colors";
import { settlementActivitySubtitle } from "../../../../lib/settlement-activity";

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
      record: expense,
    })),
    ...settlements.map((settlement) => ({
      type: "settlement" as const,
      occurredAt: settlement.occurredAt,
      record: settlement,
    })),
  ].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
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
  return (
    <>
      <Screen>
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
              onPress={() => router.push(`/groups/${group.id}/settle`)}
            />
          </View>
        </View>
        <GroupBalanceSummary lines={balanceLines} />
        <Section title="Activity">
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              message="Add the first shared cost."
            />
          ) : (
            activity.map((item, index) => {
              if (item.type === "settlement") {
                const settlement = item.record;
                const involvement = settlement.from.isViewer
                  ? "paid"
                  : settlement.to.isViewer
                    ? "received"
                    : "none";
                return (
                  <View key={`settlement:${settlement.id}`}>
                    {index > 0 ? <RowDivider inset={16} /> : null}
                    <ListRow
                      title="Payment"
                      subtitle={settlementActivitySubtitle(settlement)}
                      subtitleNumberOfLines={1}
                      trailing={
                        <ExpenseListInvolvement
                          kind={involvement}
                          amount={settlement.amount}
                        />
                      }
                      leading={
                        <Avatar
                          name={settlement.from.displayName}
                          colorKey={settlement.from.userId}
                          imageUrl={settlement.from.avatarUrl}
                        />
                      }
                    />
                  </View>
                );
              }
              const expense = item.record;
              return (
                <View key={`expense:${expense.id}`}>
                  {index > 0 ? <RowDivider inset={16} /> : null}
                  <ListRow
                    title={expense.description}
                    subtitle={expenseActivitySubtitle(expense)}
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
                </View>
              );
            })
          )}
        </Section>
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
