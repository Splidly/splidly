import {
  parseDecimalToMinor,
  type CurrencyCode,
  type RateSnapshot,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  ErrorState,
  Field,
  FormSection,
  HeaderButton,
  Intro,
  ListRow,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../components/ui";
import { CurrencyField } from "../../components/currency-field";
import { DateField } from "../../components/date-field";
import { api } from "../../lib/trpc";
import { useTheme } from "../../theme";

type Participant = {
  userId: string;
  displayName: string;
  homeCurrency: string;
};

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ type: "group" | "friend"; id: string }>();
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const group = api.groups.detail.useQuery(
    { groupId: params.id },
    { enabled: params.type === "group" },
  );
  const friend = api.friends.detail.useQuery(
    { friendshipId: params.id },
    { enabled: params.type === "friend" },
  );
  const utils = api.useUtils();
  const quote = api.currency.quote.useMutation();
  const create = api.expenses.create.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
        params.type === "group"
          ? utils.groups.detail.invalidate({ groupId: params.id })
          : Promise.resolve(),
      ]);
      router.back();
    },
  });

  const participants = useMemo<Participant[]>(() => {
    if (params.type === "group") return group.data?.members ?? [];
    const me = profile.data;
    const them = friend.data?.friend;
    return [
      ...(me
        ? [{
            userId: me.userId,
            displayName: me.displayName,
            homeCurrency: me.homeCurrency,
          }]
        : []),
      ...(them
        ? [{
            userId: them.userId,
            displayName: them.displayName,
            homeCurrency: them.homeCurrency,
          }]
        : []),
    ];
  }, [friend.data, group.data, params.type, profile.data]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payerId, setPayerId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const currencyInitialized = useRef(false);
  const [date, setDate] = useState(() => new Date());
  const [splitMode, setSplitMode] = useState<"equal" | "exact">("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    if (participants.length === 0) return;
    setSelectedIds((current) =>
      current.length > 0 ? current : participants.map((person) => person.userId),
    );
    setPayerId(
      (current) =>
        current || profile.data?.userId || participants[0]?.userId || "",
    );
    if (!currencyInitialized.current) {
      setCurrency(
        ((params.type === "group"
          ? group.data?.group.currency
          : profile.data?.homeCurrency) || "EUR") as CurrencyCode,
      );
      currencyInitialized.current = true;
    }
  }, [group.data, params.type, participants, profile.data]);

  const automaticRates = quote.data?.rates ?? [];
  const canonicalCurrency =
    params.type === "group"
      ? (group.data?.group.currency as CurrencyCode | undefined)
      : (currency as CurrencyCode);
  const contextDefaultCurrency = (
    params.type === "group"
      ? group.data?.group.currency
      : friend.data?.friend?.homeCurrency
  ) as CurrencyCode | undefined;

  async function preview() {
    setFormError(undefined);
    try {
      parseDecimalToMinor(amount, currency as CurrencyCode);
      const targets = [
        canonicalCurrency,
        ...participants
          .filter(
            (person) =>
              selectedIds.includes(person.userId) || person.userId === payerId,
          )
          .map((person) => person.homeCurrency as CurrencyCode),
      ].filter((value): value is CurrencyCode => Boolean(value));
      const result = await quote.mutateAsync({
        base: currency as CurrencyCode,
        targets: [...new Set(targets)],
      });
      setRateValues(
        Object.fromEntries(result.rates.map((rate) => [rate.quote, rate.rate])),
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Check the amount");
    }
  }

  function submit() {
    setFormError(undefined);
    if (!quote.data || !canonicalCurrency) {
      setFormError("Preview the frozen conversion before saving");
      return;
    }
    try {
      const sourceMinor = parseDecimalToMinor(amount, currency as CurrencyCode);
      const split =
        splitMode === "equal"
          ? { mode: "equal" as const, participantIds: selectedIds }
          : {
              mode: "exact" as const,
              shares: selectedIds.map((userId) => ({
                userId,
                amountMinor: parseDecimalToMinor(
                  exact[userId] ?? "0",
                  currency as CurrencyCode,
                ).toString(),
              })),
            };
      const overrides: RateSnapshot[] = automaticRates
        .filter((rate) => rateValues[rate.quote] !== rate.rate)
        .map((rate) => ({
          ...rate,
          rate: rateValues[rate.quote] ?? rate.rate,
          provider: "User override",
          source: "manual",
        }));
      create.mutate({
        context:
          params.type === "group"
            ? { type: "group", groupId: params.id }
            : { type: "friend", friendshipId: params.id },
        clientMutationId: Crypto.randomUUID(),
        description: description.trim(),
        notes: notes.trim(),
        occurredAt: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          12,
        ).toISOString(),
        payerId,
        amount: {
          currency: currency as CurrencyCode,
          minor: sourceMinor.toString(),
        },
        split,
        quoteId: quote.data.id,
        rateOverrides: overrides,
      });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Check the split");
    }
  }

  return (
    <>
      <Screen>
        <Intro>
          The original amount and every displayed conversion are frozen when you
          save.
        </Intro>
        <FormSection title="Expense">
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            autoFocus
            placeholder="Dinner"
          />
          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <CurrencyField
            label="Currency"
            value={currency}
            onValueChange={setCurrency}
            recentCurrencies={
              contextDefaultCurrency ? [contextDefaultCurrency] : []
            }
          />
          <DateField value={date} onValueChange={setDate} />
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />
        </FormSection>
      <Section title="Paid by">
        {participants.map((person, index) => (
          <View key={person.userId}>
            {index > 0 ? <RowDivider inset={16} /> : null}
            <ListRow
              title={person.displayName}
              subtitle={`Home currency · ${person.homeCurrency}`}
              onPress={() => setPayerId(person.userId)}
              trailing={
                payerId === person.userId ? (
                  <Text
                    accessibilityLabel="Selected"
                    style={{
                      color: theme.primary,
                      fontSize: 20,
                      fontWeight: "700",
                    }}
                  >
                    ✓
                  </Text>
                ) : null
              }
            />
          </View>
        ))}
      </Section>
      <Section title="Shared with">
        {participants.map((person, index) => {
          const included = selectedIds.includes(person.userId);
          return (
            <View key={person.userId}>
              {index > 0 ? <RowDivider inset={16} /> : null}
              <ListRow
                title={person.displayName}
                subtitle={`Home currency · ${person.homeCurrency}`}
                trailing={
                  <Switch
                    accessibilityLabel={`Include ${person.displayName}`}
                    value={included}
                    onValueChange={(enabled) =>
                      setSelectedIds((current) =>
                        enabled
                          ? [...new Set([...current, person.userId])]
                          : current.filter((id) => id !== person.userId),
                      )
                    }
                  />
                }
              />
            </View>
          );
        })}
      </Section>
      <Section
        title="Split"
        footer={
          splitMode === "equal"
            ? "The total is divided evenly, with remainder cents distributed deterministically."
            : "Exact shares must add up to the expense total."
        }
      >
        <ListRow
          title="Split equally"
          subtitle={splitMode === "equal" ? "Equal shares" : "Enter exact shares"}
          trailing={
            <Switch
              accessibilityLabel="Split equally"
              value={splitMode === "equal"}
              onValueChange={(enabled) =>
                setSplitMode(enabled ? "equal" : "exact")
              }
            />
          }
        />
        {splitMode === "exact" ? (
          participants
            .filter((person) => selectedIds.includes(person.userId))
            .map((person) => (
              <View key={person.userId}>
                <RowDivider inset={16} />
                <Field
                  label={`${person.displayName} · ${currency}`}
                  value={exact[person.userId] ?? ""}
                  onChangeText={(value) =>
                    setExact((current) => ({
                      ...current,
                      [person.userId]: value,
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            ))
        ) : null}
      </Section>
      <PrimaryButton
        label={quote.isPending ? "Getting rate…" : "Preview conversion"}
        tone="secondary"
        onPress={() => void preview()}
        disabled={
          quote.isPending ||
          amount.length === 0 ||
          selectedIds.length === 0
        }
      />
      {quote.data ? (
        <FormSection
          title="Frozen exchange rates"
          footer="You can correct a rate before saving. Overrides remain attached to this expense."
        >
          {automaticRates.map((rate) => (
            <Field
              key={rate.quote}
              label={`${rate.base} → ${rate.quote}`}
              value={rateValues[rate.quote] ?? rate.rate}
              onChangeText={(value) =>
                setRateValues((current) => ({
                  ...current,
                  [rate.quote]: value,
                }))
              }
              keyboardType="decimal-pad"
              editable={rate.base !== rate.quote}
            />
          ))}
        </FormSection>
      ) : null}
      <PrimaryButton
        label={create.isPending ? "Saving…" : "Save expense"}
        onPress={submit}
        disabled={
          create.isPending ||
          !quote.data ||
          description.trim().length === 0 ||
          selectedIds.length === 0
        }
      />
      {formError ? <ErrorState message={formError} /> : null}
      {quote.error ? <ErrorState message={quote.error.message} /> : null}
      {create.error ? <ErrorState message={create.error.message} /> : null}
      <Text style={{ color: theme.muted, textAlign: "center", fontSize: 12 }}>
        Splidly records the expense. It does not charge anyone.
      </Text>
      </Screen>
      {process.env.EXPO_OS !== "ios" ? (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <HeaderButton
                label="Close new expense"
                glyph="×"
                onPress={() => router.back()}
              />
            ),
          }}
        />
      ) : null}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Close new expense"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
    </>
  );
}
