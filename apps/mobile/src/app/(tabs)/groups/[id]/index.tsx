import { formatMinor, type CurrencyCode } from "@splidly/shared";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { Alert, Text, View, useColorScheme } from "react-native";
import {
  normalizeGroupIconKey,
} from "../../../../components/group-icon";
import { GroupSummaryHeader } from "../../../../components/group-summary-header";
import { ExpenseIcon } from "../../../../components/expense-icon";
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
import { groupBalanceLines } from "../../../../lib/group-balance-summary";
import { groupActionColorsFor } from "../../../../lib/group-colors";
import { useTheme } from "../../../../theme";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const detail = api.groups.detail.useQuery({ groupId: id });
  if (detail.isPending) {
    return <Screen><LoadingState /></Screen>;
  }
  if (detail.error || !detail.data) {
    return <Screen><ErrorState message={detail.error?.message} /></Screen>;
  }
  const { group, members, memberBalances, expenses } = detail.data;
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
          lines={balanceLines}
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
              label="Statistics"
              tone="secondary"
              backgroundColor={actionColors.secondaryBackground}
              foregroundColor={actionColors.secondaryForeground}
              onPress={() =>
                Alert.alert(
                  "Statistics",
                  "Group statistics are coming in a future update.",
                )
              }
            />
          </View>
        </View>
        {memberBalances.length > 0 ? (
          <Section title="Open balances">
            {memberBalances.map((memberBalance, index) => {
              const minor = BigInt(memberBalance.balance.minor);
              const absolute = minor < 0n ? -minor : minor;
              return (
                <View key={memberBalance.userId}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={memberBalance.displayName}
                    subtitle={`${
                      minor < 0n ? "You owe" : "Owes you"
                    } ${formatMinor(
                      absolute,
                      memberBalance.balance.currency as CurrencyCode,
                    )} ${memberBalance.balance.currency}`}
                    leading={
                      <Avatar
                        name={memberBalance.displayName}
                        colorKey={memberBalance.userId}
                      />
                    }
                    trailing={
                      <Text
                        style={{
                          color: theme.primary,
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        Settle
                      </Text>
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/settlement/new",
                        params: {
                          type: "group",
                          id: group.id,
                          friendId: memberBalance.userId,
                          canonicalCurrency: memberBalance.balance.currency,
                          canonicalMinor: memberBalance.balance.minor,
                        },
                      })
                    }
                  />
                </View>
              );
            })}
          </Section>
        ) : null}
        <Section title="Activity">
          {expenses.length === 0 ? (
            <EmptyState
              title="No expenses yet"
              message="Add the first shared cost in any supported currency."
            />
          ) : (
            expenses.map((expense, index) => (
              <View key={expense.id}>
                {index > 0 ? <RowDivider inset={16} /> : null}
                <ListRow
                  title={expense.description}
                  subtitle={new Date(expense.occurredAt).toLocaleDateString(
                    undefined,
                    { dateStyle: "medium" },
                  )}
                  value={`${formatMinor(
                    expense.sourceAmountMinor,
                    expense.sourceCurrency as CurrencyCode,
                  )} ${expense.sourceCurrency}`}
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
            ))
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
