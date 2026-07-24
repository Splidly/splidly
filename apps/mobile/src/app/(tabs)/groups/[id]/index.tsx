import type { CurrencyCode } from "@splidly/shared";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import {
  Avatar,
  BalanceText,
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  MoneyValue,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";
import { useTheme } from "../../../../theme";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const groupList = api.groups.list.useQuery();
  if (detail.isPending || groupList.isPending) {
    return <Screen><LoadingState /></Screen>;
  }
  if (detail.error || !detail.data) {
    return <Screen><ErrorState message={detail.error?.message} /></Screen>;
  }
  const { group, members, expenses } = detail.data;
  const summary = groupList.data?.find((item) => item.id === group.id);
  return (
    <>
      <Screen>
        <View style={{ alignItems: "center", gap: 9, paddingVertical: 8 }}>
          <Avatar name={group.name} size={76} variant="group" />
          <Text
            style={{
              color: theme.text,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: -0.6,
            }}
          >
            {group.name}
          </Text>
          <Text style={{ color: theme.muted }}>
            {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
            {group.currency}
          </Text>
          {summary ? <BalanceText value={summary.balance} size="large" /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Add expense"
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
              onPress={() =>
                Alert.alert(
                  "Statistics",
                  "Group statistics are coming in a future update.",
                )
              }
            />
          </View>
        </View>
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
                  trailing={
                    <MoneyValue
                      minor={expense.sourceAmountMinor}
                      currency={expense.sourceCurrency as CurrencyCode}
                    />
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
