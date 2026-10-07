import { useNavigationPressGuard } from "../../../lib/use-navigation-press-guard";
import type { CurrencyCode } from "@splidly/shared";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements/Header/HeaderHeightContext";
import { use, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useDeleteActivityExpense } from "../../../lib/use-delete-activity-expense";
import {
  Avatar,
  BalanceText,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { ActivityExpenseRow } from "../../../components/activity-expense-row";
import { SettlementActivityRow } from "../../../components/settlement-activity-row";
import { groupActivityByDate } from "../../../lib/activity-dates";
import { api } from "../../../lib/trpc";
import { APP_URL } from "../../../lib/env";
import { formatMoney } from "../../../lib/money-display";
import { useTheme } from "../../../theme";

export default function FriendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const headerHeight = use(HeaderHeightContext) ?? 0;
  const [compactTitleVisible, setCompactTitleVisible] = useState(
    process.env.EXPO_OS !== "ios",
  );
  const compactTitleVisibleRef = useRef(process.env.EXPO_OS !== "ios");
  const identityBottomRef = useRef(0);
  const acceptActivityNavigation = useNavigationPressGuard();
  const deletion = useDeleteActivityExpense();
  const detail = api.friends.detail.useQuery({ friendshipId: id });
  const list = api.friends.list.useQuery();
  const profile = api.profile.me.useQuery();
  if (detail.isPending || list.isPending || profile.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || profile.error || !detail.data || !profile.data) {
    return (
      <Screen>
        <ErrorState
          message={
            detail.error?.message ??
            profile.error?.message ??
            "Could not load this friend"
          }
          onRetry={() => {
            void detail.refetch();
            void profile.refetch();
          }}
        />
      </Screen>
    );
  }
  const summary = list.data?.find((item) => item.friendship.id === id);
  const name = detail.data.friend?.displayName ?? "Deleted user";
  const friendId = detail.data.friend?.userId;
  const activity = [
    ...detail.data.expenses.map((expense) => ({
      type: "expense" as const,
      occurredAt: expense.occurredAt,
      sortAt: expense.createdAt,
      record: expense,
    })),
    ...detail.data.settlements.map((settlement) => ({
      type: "settlement" as const,
      occurredAt: settlement.occurredAt,
      sortAt: settlement.createdAt,
      record: settlement,
    })),
  ];
  const activityGroups = groupActivityByDate(activity);
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
                type: "friend",
                id,
                friendshipId: id,
                friendId,
                canonicalCurrency: item.record.canonicalCurrency,
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
        value={formatMoney(
          expense.sourceAmountMinor,
          expense.sourceCurrency as CurrencyCode,
        )}
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
  return (
    <>
      <Screen
        activityList={{
          sections: activitySections,
          footer: (
            <Section>
              <ListRow
                title="Report this user"
                subtitle="Report abusive behavior or illegal content"
                showsDisclosureIndicator={false}
                onPress={() =>
                  void Linking.openURL(
                    `${APP_URL}/report?type=user&id=${encodeURIComponent(detail.data.friend?.userId ?? id)}`,
                  )
                }
              />
            </Section>
          ),
        }}
        onScroll={(event) => {
          if (process.env.EXPO_OS !== "ios") return;
          const visibleContentTop =
            event.nativeEvent.contentOffset.y +
            Math.max(event.nativeEvent.contentInset.top, headerHeight);
          const nextVisible =
            identityBottomRef.current > 0 &&
            visibleContentTop >= identityBottomRef.current;
          if (nextVisible === compactTitleVisibleRef.current) return;
          compactTitleVisibleRef.current = nextVisible;
          setCompactTitleVisible(nextVisible);
        }}
      >
        <View
          testID="friend-identity-header"
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            identityBottomRef.current = y + height;
          }}
          style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}
        >
          <Avatar
            name={name}
            colorKey={detail.data.friend?.userId ?? id}
            imageUrl={detail.data.friend?.avatarUrl}
            size={76}
          />
          <Text
            selectable={false}
            style={{
              color: theme.text,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: -0.6,
            }}
          >
            {name}
          </Text>
          <Text style={{ color: theme.muted }}>Private ledger</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Add expense"
              onPress={() =>
                router.push({
                  pathname: "/expense/new",
                  params: { type: "friend", id },
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Record payment"
              tone="secondary"
              onPress={() =>
                router.push({
                  pathname: "/settlement/new",
                  params: {
                    type: "friend",
                    id,
                    friendshipId: id,
                    friendId: detail.data.friend?.userId,
                    fromUserId: profile.data.userId,
                    toUserId: detail.data.friend?.userId,
                    canonicalCurrency: profile.data.homeCurrency,
                  },
                })
              }
            />
          </View>
        </View>
        {summary?.balances.length ? (
          <Section title="Open balances">
            {summary.balances.map((balance, index) => (
              <View
                key={`${balance.contextType}:${balance.contextId}:${balance.viewerAmount.currency}`}
              >
                {index > 0 ? <RowDivider inset={16} /> : null}
                <View style={{ padding: 16, gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text
                        selectable={false}
                        style={{
                          color: theme.text,
                          fontSize: 17,
                          fontWeight: "600",
                        }}
                      >
                        {balance.contextType === "group"
                          ? "Group ledger"
                          : "Direct ledger"}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>
                        Their view:{" "}
                        <BalanceText value={balance.counterpartyAmount} />
                      </Text>
                    </View>
                    <BalanceText
                      value={balance.viewerAmount}
                      prefix={
                        BigInt(balance.viewerAmount.minor) < 0n
                          ? "You owe "
                          : ""
                      }
                    />
                  </View>
                  <PrimaryButton
                    label="Settle this balance"
                    tone="secondary"
                    compact
                    onPress={() =>
                      router.push({
                        pathname: "/settlement/new",
                        params: {
                          type: balance.contextType,
                          id: balance.contextId,
                          friendshipId: id,
                          friendId: detail.data.friend?.userId,
                          canonicalCurrency: balance.canonicalAmount.currency,
                          canonicalMinor: balance.canonicalAmount.minor,
                        },
                      })
                    }
                  />
                </View>
              </View>
            ))}
          </Section>
        ) : null}
        {activity.length === 0 ? (
          <Section>
            <EmptyState
              title="No activity yet"
              message={`Add the first direct expense with ${name}.`}
            />
          </Section>
        ) : null}
      </Screen>
      <Stack.Screen options={{ title: compactTitleVisible ? name : "" }} />
    </>
  );
}
