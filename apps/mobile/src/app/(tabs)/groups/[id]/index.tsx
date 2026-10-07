import { useNavigationPressGuard } from "../../../../lib/use-navigation-press-guard";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { View, useColorScheme } from "react-native";
import { useDeleteActivityExpense } from "../../../../lib/use-delete-activity-expense";
import { normalizeGroupIconKey } from "../../../../components/group-icon";
import {
  GroupBalanceSummary,
  GroupSummaryHeader,
} from "../../../../components/group-summary-header";
import { ActivityExpenseRow } from "../../../../components/activity-expense-row";
import { SettlementActivityRow } from "../../../../components/settlement-activity-row";
import {
  EmptyState,
  ErrorState,
  HeaderButton,
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
import { toolbarIcons } from "../../../../lib/toolbar-icons";
import { spacing } from "../../../../theme";
import type { CurrencyCode } from "@splidly/shared";

const actionGap = 10;

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [actionRowWidth, setActionRowWidth] = useState<number>();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const acceptActivityNavigation = useNavigationPressGuard();
  const deletion = useDeleteActivityExpense();
  const detail = api.groups.detail.useQuery({ groupId: id });
  if (detail.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <Screen>
        <ErrorState
          message={detail.error?.message}
          onRetry={() => void detail.refetch()}
        />
      </Screen>
    );
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
  const actionColors = groupActionColorsFor(group.color, group.id, colorScheme);
  const actionButtonStyle =
    process.env.EXPO_OS === "ios" && actionRowWidth !== undefined
      ? { width: Math.max(0, (actionRowWidth - actionGap) / 2) }
      : { flex: 1 };
  const outstandingMinor = memberBalances.reduce((total, member) => {
    const minor = BigInt(member.balance.minor);
    return total + (minor < 0n ? -minor : minor);
  }, 0n);
  function openActivity(destination: Href) {
    if (acceptActivityNavigation()) router.push(destination);
  }
  function renderActivityItem(item: (typeof activity)[number]) {
    if (item.type === "settlement") {
      return (
        <SettlementActivityRow
          settlement={item.record}
          onPress={() =>
            openActivity({
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
      <ActivityExpenseRow
        title={expense.description}
        subtitle={expensePaymentSummary(expense.payers, expense.paymentTotal)}
        involvement={expense.viewerInvolvement}
        iconKey={expense.iconKey}
        useNameFallback={!expense.iconManuallySet}
        onPress={() => openActivity(`/expense/${expense.id}` as Href)}
      />
    );
  }
  const activitySections = activityGroups.map((dateGroup) => ({
    key: dateGroup.key,
    label: dateGroup.label,
    data: dateGroup.items.map((item) => ({
      key: `${item.type}:${item.record.id}`,
      content: renderActivityItem(item),
      ...(item.type === "expense"
        ? {
            onDelete: () => deletion.confirmDelete(item.record),
            deleteLabel: `Delete ${item.record.description}`,
            deletionDisabled: deletion.isPending,
          }
        : {}),
    })),
  }));
  const emptyActivity =
    activity.length === 0 ? (
      <Section>
        <EmptyState
          title="No activity yet"
          message="Add the first shared cost."
        />
      </Section>
    ) : null;
  return (
    <>
      <Screen
        activityList={{
          sections: activitySections,
          ...(process.env.EXPO_OS === "ios" && {
            footer: emptyActivity ? (
              <View style={{ paddingTop: spacing.lg }}>{emptyActivity}</View>
            ) : null,
          }),
        }}
        refreshing={detail.isRefetching}
        onRefresh={() => detail.refetch()}
      >
        <View testID="group-identity-header">
          <GroupSummaryHeader
            iconKey={normalizeGroupIconKey(group.iconKey)}
            name={group.name}
            colorKey={group.id}
            color={group.color}
            imageUrl={group.imageUrl}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: actionGap,
            ...(process.env.EXPO_OS === "ios" && { width: "100%" }),
          }}
          onLayout={
            process.env.EXPO_OS === "ios"
              ? (event) => {
                  const { width } = event.nativeEvent.layout;
                  if (width > 0) setActionRowWidth(width);
                }
              : undefined
          }
        >
          <View style={actionButtonStyle}>
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
          <View style={actionButtonStyle}>
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
          accessibilityLabel={`${group.name} members and balances`}
          onPress={() => router.push(`/groups/${group.id}/settings`)}
        />
        {process.env.EXPO_OS !== "ios" ? emptyActivity : null}
      </Screen>
      <Stack.Screen
        options={{
          title: process.env.EXPO_OS === "ios" ? "" : group.name,
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <HeaderButton
                  label={`${group.name} statistics`}
                  glyph="▥"
                  onPress={() =>
                    router.push(`/groups/${group.id}/statistics` as Href)
                  }
                />
                <HeaderButton
                  label={`${group.name} settings`}
                  glyph="⚙"
                  onPress={() => router.push(`/groups/${group.id}/settings`)}
                />
              </View>
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={toolbarIcons.statistics}
          accessibilityLabel={`${group.name} statistics`}
          onPress={() => router.push(`/groups/${group.id}/statistics` as Href)}
        />
        <Stack.Toolbar.Button
          icon={toolbarIcons.settings}
          accessibilityLabel={`${group.name} settings`}
          onPress={() => router.push(`/groups/${group.id}/settings`)}
        />
      </Stack.Toolbar>
    </>
  );
}
