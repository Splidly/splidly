import type { CurrencyCode } from "@splidly/shared";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { Alert, Text, View } from "react-native";
import { ExpenseDetailHero } from "../../../components/expense-detail-hero";
import {
  Avatar,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  MoneyValue,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import {
  expenseItemAllocationModeLabels,
  expenseSplitModeLabels,
} from "../../../lib/expense-split";
import { expenseTotalInCurrency } from "../../../lib/expense-detail";
import { formatExchangeRate } from "../../../lib/money-display";
import { api } from "../../../lib/trpc";
import { useTheme } from "../../../theme";

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const detail = api.expenses.detail.useQuery({ expenseId: id });
  const profile = api.profile.me.useQuery();
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
      <Screen background="sheet">
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <Screen background="sheet">
        <ErrorState message={detail.error?.message} />
      </Screen>
    );
  }

  const { expense, payers, rates, split, splits } = detail.data;
  const sourceCurrency = expense.sourceCurrency as CurrencyCode;
  const homeCurrency = profile.data?.homeCurrency as CurrencyCode | undefined;
  const homeAmountMinor = homeCurrency
    ? expenseTotalInCurrency(
        expense.sourceAmountMinor,
        sourceCurrency,
        homeCurrency,
        rates,
      )
    : undefined;
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
      <Screen
        background="sheet"
        contentContainerStyle={{ paddingTop: 12, gap: 20 }}
      >
        <ExpenseDetailHero
          description={expense.description}
          iconKey={expense.iconKey}
          iconManuallySet={expense.iconManuallySet}
          sourceAmountMinor={expense.sourceAmountMinor}
          sourceCurrency={sourceCurrency}
          homeAmountMinor={homeAmountMinor}
          homeCurrency={homeCurrency}
          dateLabel={expense.occurredAt.toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          ledgerLabel={
            expense.contextType === "group" ? "Group expense" : "Direct expense"
          }
        />

        <Section title="Paid by">
          {payers.map((payer, index) => (
            <View key={payer.userId}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={payer.displayName}
                subtitle="Paid toward this expense"
                leading={
                  <Avatar
                    name={payer.displayName}
                    colorKey={payer.userId}
                    imageUrl={payer.avatarUrl}
                  />
                }
                trailing={
                  <MoneyValue
                    minor={payer.sourceAmountMinor}
                    currency={sourceCurrency}
                  />
                }
              />
            </View>
          ))}
        </Section>

        <Section
          title="Split"
          footer={`${splits.length} ${splits.length === 1 ? "person" : "people"} included`}
        >
          <ListRow
            title="Split method"
            value={expenseSplitModeLabels[split.mode]}
          />
          {splits.map((person) => (
            <View key={person.userId}>
              <RowDivider />
              <ListRow
                title={person.displayName}
                leading={
                  <Avatar
                    name={person.displayName}
                    colorKey={person.userId}
                    imageUrl={person.avatarUrl}
                  />
                }
                trailing={
                  <MoneyValue
                    minor={person.sourceAmountMinor}
                    currency={sourceCurrency}
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
                      currency={sourceCurrency}
                    />
                  }
                />
              </View>
            ))}
          </Section>
        ) : null}

        {expense.notes ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: theme.muted,
                paddingHorizontal: 16,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Notes
            </Text>
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: theme.surface,
              }}
            >
              <Text
                selectable
                style={{ color: theme.text, fontSize: 16, lineHeight: 23 }}
              >
                {expense.notes}
              </Text>
            </View>
          </View>
        ) : null}

        {rates.some((rate) => rate.base !== rate.quote) ? (
          <Section
            title="Conversion"
            footer="Saved exchange rates keep this expense stable over time."
          >
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
            showsDisclosureIndicator={false}
            {...(remove.isPending ? {} : { onPress: confirmDelete })}
          />
        </Section>
        {profile.error ? <ErrorState message={profile.error.message} /> : null}
        {remove.error ? <ErrorState message={remove.error.message} /> : null}
      </Screen>
      <Stack.Screen
        options={{
          title: "Expense",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton
                label="Close expense details"
                glyph="×"
                onPress={() => router.back()}
              />
            ),
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
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Close expense details"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
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
