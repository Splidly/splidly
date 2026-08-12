import type { CurrencyCode } from "@splidly/shared";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { Alert, Text, View } from "react-native";
import {
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  MoneyValue,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { ExpenseIcon } from "../../../components/expense-icon";
import {
  expenseItemAllocationModeLabels,
  expenseSplitModeLabels,
} from "../../../lib/expense-split";
import {
  currencySymbol,
  formatExchangeRate,
  formatMoney,
} from "../../../lib/money-display";
import { api } from "../../../lib/trpc";
import { useTheme } from "../../../theme";

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const detail = api.expenses.detail.useQuery({ expenseId: id });
  const utils = api.useUtils();
  const remove = api.expenses.remove.useMutation({
    async onSuccess() {
      const expense = detail.data?.expense;
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
        expense?.groupId
          ? utils.groups.detail.invalidate({ groupId: expense.groupId })
          : Promise.resolve(),
        expense?.groupId
          ? utils.groups.balances.invalidate({ groupId: expense.groupId })
          : Promise.resolve(),
        expense?.friendshipId
          ? utils.friends.detail.invalidate({
              friendshipId: expense.friendshipId,
            })
          : Promise.resolve(),
      ]);
      router.back();
    },
  });

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
        <ErrorState message={detail.error?.message} />
      </Screen>
    );
  }

  const { expense, payers, rates, split, splits } = detail.data;
  const currency = expense.sourceCurrency as CurrencyCode;
  const editExpense = () => router.push(`/expense/${expense.id}/edit` as Href);

  function confirmDelete() {
    Alert.alert(
      "Delete expense?",
      `“${expense.description}” will be removed and its balances will be reversed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate({
              expenseId: expense.id,
              expectedVersion: expense.version,
            }),
        },
      ],
    );
  }

  return (
    <>
      <Screen>
        <View style={{ alignItems: "center", gap: 7, paddingVertical: 12 }}>
          <ExpenseIcon
            iconKey={expense.iconKey}
            name={expense.description}
            size={64}
            useNameFallback={!expense.iconManuallySet}
          />
          <Text
            style={{
              color: theme.text,
              fontSize: 34,
              fontWeight: "700",
              letterSpacing: -1,
            }}
          >
            {formatMoney(expense.sourceAmountMinor, currency)}
          </Text>
          <Text
            style={{
              color: theme.text,
              fontSize: 20,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {expense.description}
          </Text>
        </View>

        <Section title="Details">
          <ListRow
            title="Date"
            value={expense.occurredAt.toLocaleDateString(undefined, {
              dateStyle: "long",
            })}
          />
          <RowDivider inset={16} />
          <ListRow
            title="Ledger"
            value={
              expense.contextType === "group"
                ? "Group expense"
                : "Direct expense"
            }
          />
        </Section>

        <Section title="Paid by">
          {payers.map((payer, index) => (
            <View key={payer.userId}>
              {index > 0 ? <RowDivider inset={16} /> : null}
              <ListRow
                title={payer.displayName}
                subtitle={`Home currency · ${currencySymbol(
                  payer.homeCurrency as CurrencyCode,
                )}`}
                trailing={
                  <MoneyValue
                    minor={payer.sourceAmountMinor}
                    currency={currency}
                  />
                }
              />
            </View>
          ))}
        </Section>

        {expense.notes ? (
          <Section title="Notes">
            <Text
              style={{
                color: theme.text,
                fontSize: 16,
                lineHeight: 22,
                padding: 16,
              }}
            >
              {expense.notes}
            </Text>
          </Section>
        ) : null}

        <Section title="Split">
          <ListRow title="Method" value={expenseSplitModeLabels[split.mode]} />
          <RowDivider inset={16} />
          {splits.map((split, index) => (
            <View key={split.userId}>
              {index > 0 ? <RowDivider inset={16} /> : null}
              <ListRow
                title={split.displayName}
                subtitle={`Home currency · ${currencySymbol(
                  split.homeCurrency as CurrencyCode,
                )}`}
                trailing={
                  <MoneyValue
                    minor={split.sourceAmountMinor}
                    currency={currency}
                  />
                }
              />
            </View>
          ))}
        </Section>

        {split.mode === "itemized" ? (
          <Section title="Items">
            {split.items.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <RowDivider inset={16} /> : null}
                <ListRow
                  title={item.description || `Item ${index + 1}`}
                  subtitle={`${item.participantIds
                    .map(
                      (userId) =>
                        splits.find((person) => person.userId === userId)
                          ?.displayName ?? "Unknown",
                    )
                    .join(", ")} · ${
                    expenseItemAllocationModeLabels[
                      item.allocation?.mode ?? "equal"
                    ]
                  }`}
                  trailing={
                    <MoneyValue
                      minor={BigInt(item.amountMinor)}
                      currency={currency}
                    />
                  }
                />
              </View>
            ))}
          </Section>
        ) : null}

        {rates.some((rate) => rate.base !== rate.quote) ? (
          <Section title="Frozen exchange rates">
            {rates
              .filter((rate) => rate.base !== rate.quote)
              .map((rate, index) => (
                <View key={`${rate.base}:${rate.quote}`}>
                  {index > 0 ? <RowDivider inset={16} /> : null}
                  <ListRow
                    title={`${rate.base} → ${rate.quote}`}
                    subtitle={`${rate.provider} · ${rate.providerDate}`}
                    value={formatExchangeRate(rate.rate)}
                  />
                </View>
              ))}
          </Section>
        ) : null}

        <Section>
          <ListRow
            title={remove.isPending ? "Deleting…" : "Delete expense"}
            destructive
            {...(remove.isPending ? {} : { onPress: confirmDelete })}
          />
        </Section>
        {remove.error ? <ErrorState message={remove.error.message} /> : null}
      </Screen>
      <Stack.Screen
        options={{
          title: "Expense",
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton
                label="Edit expense"
                glyph="Edit"
                onPress={editExpense}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="pencil"
          accessibilityLabel="Edit expense"
          onPress={editExpense}
        />
      </Stack.Toolbar>
    </>
  );
}
