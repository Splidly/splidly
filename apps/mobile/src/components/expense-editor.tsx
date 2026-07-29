import {
  convertMinor,
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type ExpenseContext,
  type RateSnapshot,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { api } from "../lib/trpc";
import { useTheme } from "../theme";
import { CurrencyField } from "./currency-field";
import { DateField } from "./date-field";
import {
  ErrorState,
  Field,
  FormSection,
  HeaderButton,
  Intro,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "./ui";

type Participant = {
  userId: string;
  displayName: string;
  homeCurrency: string;
};

function requiredRateTargets(
  canonicalCurrency: CurrencyCode | undefined,
  participants: Participant[],
  selectedIds: string[],
  payerId: string,
) {
  return [
    canonicalCurrency,
    ...participants
      .filter(
        (person) =>
          selectedIds.includes(person.userId) || person.userId === payerId,
      )
      .map((person) => person.homeCurrency as CurrencyCode),
  ].filter((value): value is CurrencyCode => Boolean(value));
}

function rateBasis(base: CurrencyCode, targets: CurrencyCode[]) {
  return `${base}:${[...new Set(targets)].sort().join(",")}`;
}

export function ExpenseEditor({
  expenseId,
  newContext,
}: {
  expenseId?: string;
  newContext?: ExpenseContext;
}) {
  const theme = useTheme();
  const editing = Boolean(expenseId);
  const detail = api.expenses.detail.useQuery(
    { expenseId: expenseId ?? "" },
    { enabled: editing },
  );
  const context = useMemo<ExpenseContext | undefined>(() => {
    if (!editing) return newContext;
    const expense = detail.data?.expense;
    if (expense?.contextType === "group" && expense.groupId) {
      return { type: "group", groupId: expense.groupId };
    }
    if (expense?.contextType === "friend" && expense.friendshipId) {
      return { type: "friend", friendshipId: expense.friendshipId };
    }
    return undefined;
  }, [detail.data?.expense, editing, newContext]);
  const contextId =
    context?.type === "group"
      ? context.groupId
      : context?.type === "friend"
        ? context.friendshipId
        : "";
  const profile = api.profile.me.useQuery();
  const group = api.groups.detail.useQuery(
    { groupId: contextId },
    { enabled: context?.type === "group" },
  );
  const friend = api.friends.detail.useQuery(
    { friendshipId: contextId },
    { enabled: context?.type === "friend" },
  );
  const utils = api.useUtils();
  const quote = api.currency.quote.useMutation();
  const requestQuote = quote.mutateAsync;

  async function finishSaving() {
    await Promise.all([
      utils.friends.list.invalidate(),
      utils.groups.list.invalidate(),
      expenseId
        ? utils.expenses.detail.invalidate({ expenseId })
        : Promise.resolve(),
      context?.type === "group"
        ? utils.groups.detail.invalidate({ groupId: context.groupId })
        : context?.type === "friend"
          ? utils.friends.detail.invalidate({
              friendshipId: context.friendshipId,
            })
          : Promise.resolve(),
    ]);
    router.back();
  }

  const create = api.expenses.create.useMutation({
    onSuccess: finishSaving,
  });
  const update = api.expenses.update.useMutation({
    onSuccess: finishSaving,
  });

  const participants = useMemo<Participant[]>(() => {
    const active =
      context?.type === "group"
        ? (group.data?.members ?? [])
        : [
            ...(profile.data
              ? [
                  {
                    userId: profile.data.userId,
                    displayName: profile.data.displayName,
                    homeCurrency: profile.data.homeCurrency,
                  },
                ]
              : []),
            ...(friend.data?.friend
              ? [
                  {
                    userId: friend.data.friend.userId,
                    displayName: friend.data.friend.displayName,
                    homeCurrency: friend.data.friend.homeCurrency,
                  },
                ]
              : []),
          ];
    const known = new Map<string, Participant>();
    for (const person of detail.data?.splits ?? []) {
      known.set(person.userId, person);
    }
    if (detail.data?.payer) {
      known.set(detail.data.payer.userId, detail.data.payer);
    }
    for (const person of active) known.set(person.userId, person);
    return [...known.values()];
  }, [
    context?.type,
    detail.data?.payer,
    detail.data?.splits,
    friend.data?.friend,
    group.data?.members,
    profile.data,
  ]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payerId, setPayerId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [date, setDate] = useState(() => new Date());
  const [splitMode, setSplitMode] = useState<"equal" | "exact">("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [frozenRates, setFrozenRates] = useState<RateSnapshot[]>([]);
  const [quoteId, setQuoteId] = useState<string>();
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<string>();
  const [previewBasis, setPreviewBasis] = useState("");
  const [rateStatus, setRateStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [rateError, setRateError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const initialized = useRef<string | undefined>(undefined);
  const rateRequest = useRef(0);

  const canonicalCurrency =
    context?.type === "group"
      ? (group.data?.group.currency as CurrencyCode | undefined)
      : context?.type === "friend"
        ? currency
        : undefined;
  const contextDefaultCurrency = (
    context?.type === "group"
      ? group.data?.group.currency
      : friend.data?.friend?.homeCurrency
  ) as CurrencyCode | undefined;
  const rateTargets = useMemo(
    () =>
      requiredRateTargets(
        canonicalCurrency,
        participants,
        selectedIds,
        payerId,
      ),
    [canonicalCurrency, participants, payerId, selectedIds],
  );
  const currentRateBasis = rateBasis(currency, rateTargets);
  const sourceMinor = useMemo(() => {
    try {
      const parsed = parseDecimalToMinor(amount, currency);
      return parsed > 0n ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [amount, currency]);
  const conversionReady =
    sourceMinor !== undefined &&
    selectedIds.length > 0 &&
    payerId.length > 0 &&
    frozenRates.length > 0 &&
    previewBasis.length > 0 &&
    previewBasis === currentRateBasis;
  const convertedAmounts = useMemo(
    () =>
      sourceMinor === undefined
        ? []
        : frozenRates
            .filter((rate) => rate.base !== rate.quote)
            .map((rate) => ({
              ...rate,
              amountMinor: convertMinor(
                sourceMinor,
                rate.base,
                rate.quote,
                rate.rate,
              ),
            })),
    [frozenRates, sourceMinor],
  );

  useEffect(() => {
    if (!context || participants.length === 0 || !canonicalCurrency) return;
    const key = expenseId ?? "new";
    if (initialized.current === key) return;

    if (!editing) {
      const initialCurrency = (
        context.type === "group"
          ? group.data?.group.currency
          : profile.data?.homeCurrency
      ) as CurrencyCode | undefined;
      setSelectedIds(participants.map((person) => person.userId));
      setPayerId(
        profile.data?.userId ?? participants[0]?.userId ?? "",
      );
      setCurrency(initialCurrency ?? "EUR");
      initialized.current = key;
      return;
    }

    if (!detail.data) return;
    const expense = detail.data.expense;
    const initialSelectedIds =
      detail.data.split.mode === "equal"
        ? detail.data.split.participantIds
        : detail.data.split.shares.map((share) => share.userId);
    const initialCurrency = expense.sourceCurrency as CurrencyCode;
    const initialCanonicalCurrency =
      context.type === "group"
        ? (group.data?.group.currency as CurrencyCode)
        : initialCurrency;
    setSelectedIds(initialSelectedIds);
    setPayerId(expense.payerId);
    setDescription(expense.description);
    setNotes(expense.notes);
    setAmount(formatMinor(expense.sourceAmountMinor, initialCurrency));
    setCurrency(initialCurrency);
    setDate(expense.occurredAt);
    setSplitMode(detail.data.split.mode);
    setExact(
      Object.fromEntries(
        detail.data.splits.map((split) => [
          split.userId,
          formatMinor(split.sourceAmountMinor, initialCurrency),
        ]),
      ),
    );
    setFrozenRates(detail.data.rates);
    setQuoteExpiresAt(undefined);
    setPreviewBasis(
      rateBasis(
        initialCurrency,
        requiredRateTargets(
          initialCanonicalCurrency,
          participants,
          initialSelectedIds,
          expense.payerId,
        ),
      ),
    );
    setRateStatus("ready");
    initialized.current = key;
  }, [
    canonicalCurrency,
    context,
    detail.data,
    editing,
    expenseId,
    group.data?.group.currency,
    participants,
    profile.data?.homeCurrency,
    profile.data?.userId,
  ]);

  useEffect(() => {
    if (
      sourceMinor === undefined ||
      selectedIds.length === 0 ||
      payerId.length === 0 ||
      rateTargets.length === 0
    ) {
      rateRequest.current += 1;
      setRateStatus("idle");
      setRateError(undefined);
      return;
    }
    if (conversionReady) {
      setRateStatus("ready");
      setRateError(undefined);
      return;
    }

    const requestId = rateRequest.current + 1;
    rateRequest.current = requestId;
    setRateStatus("loading");
    setRateError(undefined);

    if (rateTargets.every((target) => target === currency)) {
      const identityRate: RateSnapshot = {
        base: currency,
        quote: currency,
        rate: "1",
        provider: "identity",
        providerDate: new Date().toISOString().slice(0, 10),
        source: "automatic",
      };
      setFrozenRates([identityRate]);
      setQuoteId(undefined);
      setQuoteExpiresAt(undefined);
      setPreviewBasis(currentRateBasis);
      setRateStatus("ready");
      return;
    }

    const timeout = setTimeout(() => {
      void requestQuote({
        base: currency,
        targets: [...new Set(rateTargets)],
      })
        .then((result) => {
          if (rateRequest.current !== requestId) return;
          setFrozenRates(result.rates);
          setQuoteId(result.id);
          setQuoteExpiresAt(result.expiresAt);
          setPreviewBasis(currentRateBasis);
          setRateStatus("ready");
        })
        .catch((cause: unknown) => {
          if (rateRequest.current !== requestId) return;
          setQuoteId(undefined);
          setQuoteExpiresAt(undefined);
          setRateStatus("error");
          setRateError(
            cause instanceof Error
              ? cause.message
              : "Could not load exchange rates",
          );
        });
    }, 450);

    return () => {
      clearTimeout(timeout);
      if (rateRequest.current === requestId) rateRequest.current += 1;
    };
  }, [
    conversionReady,
    currency,
    currentRateBasis,
    payerId,
    rateTargets,
    requestQuote,
    selectedIds.length,
    sourceMinor,
  ]);

  useEffect(() => {
    if (!quoteExpiresAt) return;
    const refreshIn =
      new Date(quoteExpiresAt).getTime() - Date.now() - 5_000;
    const timeout = setTimeout(() => {
      setQuoteId(undefined);
      setQuoteExpiresAt(undefined);
      setPreviewBasis("");
    }, Math.max(0, refreshIn));
    return () => clearTimeout(timeout);
  }, [quoteExpiresAt]);

  function submit() {
    setFormError(undefined);
    if (!conversionReady || !context) {
      setFormError(
        rateError ?? "Wait for the currency conversion to finish updating",
      );
      return;
    }
    try {
      const validatedSourceMinor = parseDecimalToMinor(amount, currency);
      const split =
        splitMode === "equal"
          ? { mode: "equal" as const, participantIds: selectedIds }
          : {
              mode: "exact" as const,
              shares: selectedIds.map((userId) => ({
                userId,
                amountMinor: parseDecimalToMinor(
                  exact[userId] ?? "0",
                  currency,
                ).toString(),
              })),
            };
      const mutation = {
        context,
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
          currency,
          minor: validatedSourceMinor.toString(),
        },
        split,
        ...(quoteId ? { quoteId } : {}),
        rateOverrides: [],
      };
      if (expenseId && detail.data) {
        update.mutate({
          ...mutation,
          expenseId,
          expectedVersion: detail.data.expense.version,
        });
      } else {
        create.mutate(mutation);
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Check the split");
    }
  }

  const contextPending =
    profile.isPending ||
    (context?.type === "group" && group.isPending) ||
    (context?.type === "friend" && friend.isPending);
  if ((editing && detail.isPending) || contextPending) {
    return (
      <Screen background="sheet">
        <LoadingState />
      </Screen>
    );
  }
  const loadingError =
    detail.error ?? profile.error ?? group.error ?? friend.error;
  if (!context || loadingError) {
    return (
      <Screen background="sheet">
        <ErrorState message={loadingError?.message ?? "Expense not found"} />
      </Screen>
    );
  }

  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;
  return (
    <>
      <Screen background="sheet">
        <Intro>
          The original amount and every displayed conversion are frozen when you
          save.
        </Intro>
        <FormSection title="Expense">
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
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
          <View
            accessibilityLiveRegion="polite"
            style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}
          >
            <Text
              style={{
                color: theme.muted,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Currency conversion
            </Text>
            {rateStatus === "loading" ? (
              <Text style={{ color: theme.muted, fontSize: 14 }}>
                Updating exchange rates…
              </Text>
            ) : rateStatus === "error" ? (
              <Text selectable style={{ color: theme.negative, fontSize: 14 }}>
                {rateError ?? "Could not load exchange rates"}
              </Text>
            ) : sourceMinor === undefined ? (
              <Text style={{ color: theme.muted, fontSize: 14 }}>
                Enter a valid amount to see converted totals.
              </Text>
            ) : selectedIds.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 14 }}>
                Select who shares this expense.
              </Text>
            ) : conversionReady && convertedAmounts.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 14 }}>
                No currency conversion is needed.
              </Text>
            ) : conversionReady ? (
              convertedAmounts.map((rate) => (
                <View key={`${rate.base}:${rate.quote}`} style={{ gap: 2 }}>
                  <Text
                    selectable
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    ≈ {formatMinor(rate.amountMinor, rate.quote)} {rate.quote}
                  </Text>
                  <Text
                    selectable
                    style={{
                      color: theme.muted,
                      fontSize: 12,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    1 {rate.base} = {rate.rate} {rate.quote} ·{" "}
                    {rate.providerDate}
                  </Text>
                </View>
              ))
            ) : null}
          </View>
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
            subtitle={
              splitMode === "equal" ? "Equal shares" : "Enter exact shares"
            }
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
          {splitMode === "exact"
            ? participants
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
            : null}
        </Section>
        <PrimaryButton
          label={saving ? "Saving…" : editing ? "Save changes" : "Save expense"}
          onPress={submit}
          disabled={
            saving ||
            !conversionReady ||
            description.trim().length === 0 ||
            selectedIds.length === 0
          }
        />
        {formError ? <ErrorState message={formError} /> : null}
        {saveError ? <ErrorState message={saveError.message} /> : null}
        <Text style={{ color: theme.muted, textAlign: "center", fontSize: 12 }}>
          Splidly records the expense. It does not charge anyone.
        </Text>
      </Screen>
      <Stack.Screen
        options={{
          title: editing ? "Edit Expense" : "New Expense",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton
                label={editing ? "Close expense editor" : "Close new expense"}
                glyph="×"
                onPress={() => router.back()}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel={
            editing ? "Close expense editor" : "Close new expense"
          }
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
    </>
  );
}
