import { formatMinor, type CurrencyCode } from "@splidly/shared";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { Alert, Text, View } from "react-native";
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
import { useTheme } from "../../../../theme";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
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
  return (
    <>
      <Screen>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 2,
          }}
        >
          <Avatar name={group.name} size={58} variant="group" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontSize: 24,
                fontWeight: "700",
                letterSpacing: -0.5,
              }}
            >
              {group.name}
            </Text>
            {balanceLines.map((line) => (
              <Text
                key={line.key}
                selectable
                numberOfLines={1}
                style={{
                  color:
                    line.tone === "positive"
                      ? theme.positive
                      : line.tone === "negative"
                        ? theme.negative
                        : theme.muted,
                  fontSize: 13,
                  fontWeight: line.tone === "muted" ? "400" : "500",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {line.text}
              </Text>
            ))}
          </View>
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
                  value={`${formatMinor(
                    expense.sourceAmountMinor,
                    expense.sourceCurrency as CurrencyCode,
                  )} ${expense.sourceCurrency}`}
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
