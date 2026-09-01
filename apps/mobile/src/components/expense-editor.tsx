import {
  convertMinor,
  detectExpenseIconKey,
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type ExpenseContext,
  type ExpenseIconKey,
  type RateSnapshot,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  InputAccessoryView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { beginCurrencySelection } from "../lib/currency-selection";
import { api } from "../lib/trpc";
import { formatConvertedMoney, formatExchangeRate } from "../lib/money-display";
import { expensePaymentStatus } from "../lib/expense-payments";
import {
  createExpenseSplitDraft,
  expenseSplitDraftFromInput,
  expenseSplitParticipantIds,
  expenseSplitStatus,
  expenseSplitSummary,
  type ExpenseSplitDraft,
  type SplitParticipant,
} from "../lib/expense-split";
import { useTheme } from "../theme";
import { DateField } from "./date-field";
import {
  AllocationChoiceCard,
  ComposerSectionHeader,
  ExpenseEntryCard,
  ExpenseSaveControl,
} from "./expense-composer-ui";
import { ExpenseIconPicker } from "./expense-icon";
import { useExpensePaymentSession } from "./expense-payment-session";
import { useExpenseSplitSession } from "./expense-split-session";
import {
  ErrorState,
  HeaderButton,
  LoadingState,
  Screen,
  useKeyboardFocusScroll,
} from "./ui";

const expenseOverlayHeight = 92;

function requiredRateTargets(
  canonicalCurrency: CurrencyCode | undefined,
  participants: SplitParticipant[],
  selectedIds: string[],
  payerIds: string[],
) {
  return [
    canonicalCurrency,
    ...participants
      .filter(
        (person) =>
          selectedIds.includes(person.userId) ||
          payerIds.includes(person.userId),
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
  const clientMutationId = useRef(Crypto.randomUUID());
  const theme = useTheme();
  const paymentSession = useExpensePaymentSession();
  const splitSession = useExpenseSplitSession();
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
      context?.type === "group"
        ? utils.groups.balances.invalidate({ groupId: context.groupId })
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

  const participants = useMemo<SplitParticipant[]>(() => {
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
                    avatarUrl: profile.data.avatarUrl,
                  },
                ]
              : []),
            ...(friend.data?.friend
              ? [
                  {
                    userId: friend.data.friend.userId,
                    displayName: friend.data.friend.displayName,
                    homeCurrency: friend.data.friend.homeCurrency,
                    avatarUrl: friend.data.friend.avatarUrl,
                  },
                ]
              : []),
          ];
    const known = new Map<string, SplitParticipant>();
    for (const person of detail.data?.splits ?? []) {
      known.set(person.userId, person);
    }
    if (detail.data?.payer) {
      known.set(detail.data.payer.userId, detail.data.payer);
    }
    for (const person of detail.data?.payers ?? []) {
      known.set(person.userId, person);
    }
    for (const person of active) known.set(person.userId, person);
    return [...known.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      }),
    );
  }, [
    context?.type,
    detail.data?.payer,
    detail.data?.payers,
    detail.data?.splits,
    friend.data?.friend,
    group.data?.members,
    profile.data,
  ]);

  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [manualIconKey, setManualIconKey] = useState<ExpenseIconKey>();
  const [notes, setNotes] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(editing);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [date, setDate] = useState(() => new Date());
  const [splitDraft, setSplitDraft] = useState<ExpenseSplitDraft>();
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
  const screenRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const {
    keyboardClearance,
    focusInput: focusBottomInput,
    blurInput: blurBottomInput,
    revealFocusedInput: revealBottomInput,
  } = useKeyboardFocusScroll(screenRef, expenseOverlayHeight + 16);
  const detectedIconKey = useMemo(
    () => detectExpenseIconKey(description),
    [description],
  );
  const iconKey = manualIconKey ?? detectedIconKey;

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
  const sourceMinor = useMemo(() => {
    try {
      const parsed = parseDecimalToMinor(amount, currency);
      return parsed > 0n ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [amount, currency]);
  const effectiveSplitDraft = useMemo(
    () =>
      splitDraft ??
      createExpenseSplitDraft(participants, sourceMinor ?? 0n, currency),
    [currency, participants, sourceMinor, splitDraft],
  );
  const selectedIds = useMemo(
    () => expenseSplitParticipantIds(effectiveSplitDraft),
    [effectiveSplitDraft],
  );
  const paymentStatus = expensePaymentStatus(
    payerIds,
    payerAmounts,
    sourceMinor ?? 0n,
    currency,
  );
  const splitStatus = expenseSplitStatus(
    effectiveSplitDraft,
    sourceMinor ?? 0n,
    currency,
  );
  const paymentReady = sourceMinor !== undefined && paymentStatus.valid;
  const splitReady = sourceMinor !== undefined && splitStatus.valid;
  const rateTargets = useMemo(
    () =>
      requiredRateTargets(
        canonicalCurrency,
        participants,
        selectedIds,
        payerIds,
      ),
    [canonicalCurrency, participants, payerIds, selectedIds],
  );
  const currentRateBasis = rateBasis(currency, rateTargets);
  const conversionReady =
    sourceMinor !== undefined &&
    selectedIds.length > 0 &&
    payerIds.length > 0 &&
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
      setPayerIds(
        [profile.data?.userId ?? participants[0]?.userId ?? ""].filter(Boolean),
      );
      setCurrency(initialCurrency ?? "EUR");
      initialized.current = key;
      return;
    }

    if (!detail.data) return;
    const expense = detail.data.expense;
    const initialCurrency = expense.sourceCurrency as CurrencyCode;
    const initialSplitDraft = expenseSplitDraftFromInput(
      detail.data.split,
      participants,
      expense.sourceAmountMinor,
      initialCurrency,
    );
    const initialSelectedIds = expenseSplitParticipantIds(initialSplitDraft);
    const storedPayers = detail.data.payers ?? [];
    const initialPayers =
      storedPayers.length > 0
        ? storedPayers
        : detail.data.payer
          ? [
              {
                ...detail.data.payer,
                sourceAmountMinor: expense.sourceAmountMinor,
              },
            ]
          : [];
    const initialPayerIds = initialPayers.map((payer) => payer.userId);
    const initialCanonicalCurrency =
      context.type === "group"
        ? (group.data?.group.currency as CurrencyCode)
        : initialCurrency;
    setSplitDraft(initialSplitDraft);
    setPayerIds(initialPayerIds);
    setPayerAmounts(
      Object.fromEntries(
        initialPayers.map((payer) => [
          payer.userId,
          formatMinor(payer.sourceAmountMinor, initialCurrency),
        ]),
      ),
    );
    setDescription(expense.description);
    setManualIconKey(expense.iconManuallySet ? expense.iconKey : undefined);
    setNotes(expense.notes);
    setAmount(formatMinor(expense.sourceAmountMinor, initialCurrency));
    setCurrency(initialCurrency);
    setDate(expense.occurredAt);
    setFrozenRates(detail.data.rates);
    setQuoteExpiresAt(undefined);
    setPreviewBasis(
      rateBasis(
        initialCurrency,
        requiredRateTargets(
          initialCanonicalCurrency,
          participants,
          initialSelectedIds,
          initialPayerIds,
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
      payerIds.length === 0 ||
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
    payerIds,
    rateTargets,
    requestQuote,
    selectedIds.length,
    sourceMinor,
  ]);

  useEffect(() => {
    if (!quoteExpiresAt) return;
    const refreshIn = new Date(quoteExpiresAt).getTime() - Date.now() - 5_000;
    const timeout = setTimeout(
      () => {
        setQuoteId(undefined);
        setQuoteExpiresAt(undefined);
        setPreviewBasis("");
      },
      Math.max(0, refreshIn),
    );
    return () => clearTimeout(timeout);
  }, [quoteExpiresAt]);

  function submit() {
    setFormError(undefined);
    if (!context || sourceMinor === undefined) {
      setFormError("Enter a valid positive expense amount");
      return;
    }
    if (!paymentStatus.valid || !paymentStatus.payments) {
      setFormError(paymentStatus.message);
      return;
    }
    if (!splitStatus.valid || !splitStatus.input) {
      setFormError(splitStatus.message);
      return;
    }
    if (!conversionReady) {
      setFormError(
        rateError ?? "Wait for the currency conversion to finish updating",
      );
      return;
    }
    try {
      const mutation = {
        context,
        clientMutationId: clientMutationId.current,
        description: description.trim(),
        iconKey,
        iconManuallySet: manualIconKey !== undefined,
        notes: notes.trim(),
        occurredAt: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          12,
        ).toISOString(),
        payments: paymentStatus.payments,
        amount: {
          currency,
          minor: sourceMinor.toString(),
        },
        split: splitStatus.input,
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
      <Screen underlapsHeader={false}>
        <LoadingState />
      </Screen>
    );
  }
  const loadingError =
    detail.error ?? profile.error ?? group.error ?? friend.error;
  if (!context || loadingError) {
    return (
      <Screen underlapsHeader={false}>
        <ErrorState
          message={loadingError?.message ?? "Expense not found"}
          onRetry={() => {
            void profile.refetch();
            if (editing) void detail.refetch();
            if (context?.type === "group") void group.refetch();
            if (context?.type === "friend") void friend.refetch();
          }}
        />
      </Screen>
    );
  }

  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;
  const payerNames = payerIds
    .map((payerId) =>
      payerId === profile.data?.userId
        ? "You"
        : participants.find((person) => person.userId === payerId)?.displayName,
    )
    .filter((name): name is string => Boolean(name));
  const paymentSummary =
    payerNames.length === 0
      ? "Choose who paid"
      : payerNames.length === 1
        ? `${payerNames[0]} paid`
        : payerNames.length === 2
          ? `${payerNames[0]} and ${payerNames[1]} paid`
          : `${payerNames[0]} and ${payerNames.length - 1} others paid`;
  const onlyCurrentUserPaid =
    payerNames.length === 1 && payerNames[0] === "You";
  const saveDisabled =
    saving ||
    !conversionReady ||
    !paymentStatus.valid ||
    !splitStatus.valid ||
    description.trim().length === 0 ||
    selectedIds.length === 0 ||
    payerIds.length === 0;
  const openCurrency = () => {
    beginCurrencySelection(
      currency,
      setCurrency,
      contextDefaultCurrency ? [contextDefaultCurrency] : [],
    );
    router.push("/currency-picker");
  };
  const openPaymentAllocation = () => {
    if (sourceMinor === undefined) {
      setFormError("Enter a valid expense amount before assigning payment");
      return;
    }
    setFormError(undefined);
    paymentSession.open({
      currency,
      totalMinor: sourceMinor,
      participants,
      draft: { payerIds, payerAmounts },
      onSave: (draft) => {
        setPayerIds(draft.payerIds);
        setPayerAmounts(draft.payerAmounts);
      },
    });
    router.push("/expense/payment");
  };
  const openSplitAllocation = () => {
    if (sourceMinor === undefined) {
      setFormError("Enter a valid expense amount before splitting it");
      return;
    }
    setFormError(undefined);
    splitSession.open({
      currency,
      totalMinor: sourceMinor,
      participants,
      draft: effectiveSplitDraft,
      onSave: setSplitDraft,
    });
    router.push("/expense/split");
  };

  const formatAmountOnBlur = () => {
    try {
      setAmount(formatMinor(parseDecimalToMinor(amount, currency), currency));
    } catch {
      // Keep incomplete input intact so validation can explain the problem.
    }
  };

  const descriptionAccessoryID = "expense-description-primary-action";
  const amountAccessoryID = "expense-amount-primary-action";
  const saveLabel = saving
    ? "Saving…"
    : editing
      ? "Save changes"
      : "Save expense";

  const conversionMetadata = (
    <View accessibilityLiveRegion="polite" style={{ gap: 3 }}>
      {rateStatus === "loading" ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          Updating exchange rates…
        </Text>
      ) : rateStatus === "error" ? (
        <Text style={{ color: theme.negative, fontSize: 13 }}>
          {rateError ?? "Could not load exchange rates"}
        </Text>
      ) : sourceMinor === undefined ? (
        amount.trim().length > 0 ? (
          <Text style={{ color: theme.warning, fontSize: 13 }}>
            Enter a valid positive amount
          </Text>
        ) : null
      ) : selectedIds.length === 0 ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          Choose the split to preview converted totals
        </Text>
      ) : conversionReady && convertedAmounts.length === 0 ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          No currency conversion needed
        </Text>
      ) : conversionReady ? (
        convertedAmounts.map((rate) => (
          <View
            key={`${rate.base}:${rate.quote}`}
            style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
          >
            <Text
              style={{
                color: theme.primary,
                fontSize: 15,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              ≈ {formatConvertedMoney(rate.amountMinor, rate.quote)}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: theme.muted,
                flex: 1,
                fontSize: 11,
                fontVariant: ["tabular-nums"],
              }}
            >
              1 {rate.base} = {formatExchangeRate(rate.rate)} {rate.quote} ·{" "}
              {rate.providerDate}
            </Text>
          </View>
        ))
      ) : null}
    </View>
  );

  return (
    <>
      <Screen
        scrollViewRef={screenRef}
        transientBottomClearance={keyboardClearance}
        underlapsHeader={false}
        bottomOverlay={
          <ExpenseSaveControl
            label={saveLabel}
            onPress={submit}
            disabled={saveDisabled}
          />
        }
        bottomOverlayHeight={expenseOverlayHeight}
        contentContainerStyle={{ paddingTop: 16, gap: 22 }}
      >
        <ExpenseEntryCard
          icon={
            <ExpenseIconPicker
              value={iconKey}
              automatic={manualIconKey === undefined}
              onValueChange={setManualIconKey}
              name={description}
              size={58}
            />
          }
          description={description}
          onDescriptionChange={setDescription}
          amount={amount}
          onAmountChange={setAmount}
          onAmountBlur={formatAmountOnBlur}
          currency={currency}
          onCurrencyPress={openCurrency}
          categoryHint={
            manualIconKey
              ? "Custom category · Tap the icon to change"
              : "Category follows the description · Tap the icon to change"
          }
          metadata={conversionMetadata}
          {...(process.env.EXPO_OS === "ios"
            ? {
                descriptionInputAccessoryViewID: descriptionAccessoryID,
                amountInputAccessoryViewID: amountAccessoryID,
              }
            : {})}
        />

        <View style={{ gap: 10 }}>
          <ComposerSectionHeader
            title="Payment plan"
            subtitle="Review who paid and how the expense is shared."
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <AllocationChoiceCard
              title={onlyCurrentUserPaid ? "Paid by You" : "Paid by"}
              accessibilityLabel="Paid by"
              {...(sourceMinor === undefined
                ? { subtitle: "Add an amount first" }
                : onlyCurrentUserPaid
                  ? {}
                  : { subtitle: paymentSummary })}
              glyph="↑"
              enabled={sourceMinor !== undefined}
              ready={paymentReady}
              onPress={openPaymentAllocation}
            />
            <AllocationChoiceCard
              title="Split"
              subtitle={
                sourceMinor === undefined
                  ? "Add an amount first"
                  : expenseSplitSummary(effectiveSplitDraft)
              }
              glyph="÷"
              enabled={sourceMinor !== undefined}
              ready={splitReady}
              onPress={openSplitAllocation}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <ComposerSectionHeader
            title="Details"
            subtitle="Set the date and add anything worth remembering."
          />
          <View
            style={{
              overflow: "hidden",
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: theme.surface,
            }}
          >
            <DateField value={date} onValueChange={setDate} />
            <View
              style={{
                height: 1,
                marginLeft: 16,
                backgroundColor: theme.border,
              }}
            />
            {notesExpanded ? (
              <View
                style={{ paddingHorizontal: 16, paddingVertical: 13, gap: 6 }}
              >
                <Text
                  style={{
                    color: theme.muted,
                    fontSize: 12,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Note
                </Text>
                <TextInput
                  ref={notesInputRef}
                  accessibilityLabel="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note…"
                  placeholderTextColor={theme.subtle}
                  selectionColor={theme.primary}
                  multiline
                  onFocus={() => focusBottomInput(notesInputRef.current)}
                  onBlur={() => blurBottomInput(notesInputRef.current)}
                  onContentSizeChange={() =>
                    requestAnimationFrame(revealBottomInput)
                  }
                  textAlignVertical="top"
                  style={{
                    color: theme.text,
                    minHeight: 72,
                    padding: 0,
                    fontSize: 16,
                    lineHeight: 21,
                  }}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setNotesExpanded(true)}
                style={({ pressed }) => ({
                  minHeight: 54,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: pressed ? 0.62 : 1,
                })}
              >
                <Text
                  accessibilityElementsHidden
                  style={{ color: theme.primary, fontSize: 20 }}
                >
                  ＋
                </Text>
                <Text
                  style={{
                    color: theme.primary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Add a note
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {formError ? <ErrorState message={formError} /> : null}
        {saveError ? <ErrorState message={saveError.message} /> : null}
      </Screen>
      {process.env.EXPO_OS === "ios"
        ? [descriptionAccessoryID, amountAccessoryID].map((accessoryID) => (
            <InputAccessoryView
              key={accessoryID}
              nativeID={accessoryID}
              backgroundColor={theme.background}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 8,
                  alignItems: "center",
                  backgroundColor: theme.background,
                }}
              >
                <ExpenseSaveControl
                  label={
                    saving
                      ? "Saving…"
                      : editing
                        ? "Save changes"
                        : "Add expense"
                  }
                  onPress={submit}
                  disabled={saveDisabled}
                />
              </View>
            </InputAccessoryView>
          ))
        : null}
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
