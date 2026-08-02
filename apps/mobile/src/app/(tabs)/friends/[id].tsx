import type { CurrencyCode } from "@splidly/shared";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { Text, View } from "react-native";
import { ActivityTimeline } from "../../../components/activity-timeline";
import {
  Avatar,
  BalanceText,
  EmptyState,
  ErrorState,
  Intro,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { ExpenseIcon } from "../../../components/expense-icon";
import { groupActivityByDate } from "../../../lib/activity-dates";
import { api } from "../../../lib/trpc";
import { formatMoney } from "../../../lib/money-display";
import { useTheme } from "../../../theme";

export default function FriendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const detail = api.friends.detail.useQuery({ friendshipId: id });
  const list = api.friends.list.useQuery();
  const profile = api.profile.me.useQuery();
  if (detail.isPending || list.isPending || profile.isPending) {
    return <Screen><LoadingState /></Screen>;
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
        />
      </Screen>
    );
  }
  const summary = list.data?.find((item) => item.friendship.id === id);
  const name = detail.data.friend?.displayName ?? "Deleted user";
  const expenseGroups = groupActivityByDate(detail.data.expenses);
  return (
    <>
      <Screen>
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
          <Avatar
            name={name}
            colorKey={detail.data.friend?.userId ?? id}
            imageUrl={detail.data.friend?.avatarUrl}
            size={76}
          />
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.6 }}>
            {name}
          </Text>
          <Text style={{ color: theme.muted }}>
            Private ledger
          </Text>
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
        <Intro>
          Direct and group balances stay separated so every amount remains
          traceable to its original ledger.
        </Intro>
        {summary?.balances.length ? (
          <Section title="Open balances">
            {summary.balances.map((balance, index) => (
              <View key={`${balance.contextType}:${balance.contextId}:${balance.viewerAmount.currency}`}>
                {index > 0 ? <RowDivider inset={16} /> : null}
                <View style={{ padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>
                        {balance.contextType === "group" ? "Group ledger" : "Direct ledger"}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>
                        Their view: <BalanceText value={balance.counterpartyAmount} />
                      </Text>
                    </View>
                    <BalanceText
                      value={balance.viewerAmount}
                      prefix={BigInt(balance.viewerAmount.minor) < 0n ? "You owe " : ""}
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
        {detail.data.expenses.length === 0 ? (
          <Section>
            <EmptyState
              title="No expenses yet"
              message={`Add the first direct expense with ${name}.`}
            />
          </Section>
        ) : (
          <ActivityTimeline
            groups={expenseGroups}
            getItemKey={(expense) => expense.id}
            renderItem={(expense) => (
              <ListRow
                title={expense.description}
                value={formatMoney(
                  expense.sourceAmountMinor,
                  expense.sourceCurrency as CurrencyCode,
                )}
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
            )}
          />
        )}
      </Screen>
      <Stack.Screen options={{ title: name }} />
    </>
  );
}
