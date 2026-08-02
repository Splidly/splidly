import {
  convertMinor,
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type QuoteResult,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import {
  router,
  Stack,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { beginCurrencySelection } from "../../lib/currency-selection";
import { formatConvertedMoney } from "../../lib/money-display";
import { api } from "../../lib/trpc";
import {
  SettlementAmountCard,
  SettlementDirectionCard,
  SettlementSaveControl,
  type SettlementMember,
} from "../../components/settlement-composer";
import { DateField } from "../../components/date-field";
import {
  ErrorState,
  HeaderButton,
  LoadingState,
  Screen,
} from "../../components/ui";
import { useTheme } from "../../theme";

function rateBasis(base: CurrencyCode, targets: CurrencyCode[]) {
  return `${base}:${[...new Set(targets)].sort().join(",")}`;
}

export default function NewSettlementScreen() {
  const params = useLocalSearchParams<{
    type: "group" | "friend";
    id: string;
    friendshipId?: string;
    friendId?: string;
    fromUserId?: string;
    toUserId?: string;
    canonicalCurrency: CurrencyCode;
    canonicalMinor?: string;
  }>();
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const friend = api.friends.detail.useQuery(
    { friendshipId: params.friendshipId ?? "" },
    {
      enabled: params.type === "friend" && Boolean(params.friendshipId),
    },
  );
  const group = api.groups.detail.useQuery(
    { groupId: params.id },
    { enabled: params.type === "group" },
  );
  const utils = api.useUtils();
  const quote = api.currency.quote.useMutation();
  const requestQuote = quote.mutateAsync;
  const quoteRequest = useRef(0);

  let signedCanonicalMinor: bigint | undefined;
  try {
    signedCanonicalMinor = params.canonicalMinor
      ? BigInt(params.canonicalMinor)
      : undefined;
  } catch {
    signedCanonicalMinor = undefined;
  }

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(params.canonicalCurrency);
  const [fromUserId, setFromUserId] = useState(params.fromUserId ?? "");
  const [toUserId, setToUserId] = useState(params.toUserId ?? "");
  const [date, setDate] = useState(() => new Date());
  const [notes, setNotes] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [activeQuote, setActiveQuote] = useState<QuoteResult>();
  const [activeRateBasis, setActiveRateBasis] = useState("");
  const [rateStatus, setRateStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [rateError, setRateError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const closeHref = (
    params.friendshipId
      ? `/friends/${params.friendshipId}`
      : params.type === "group"
        ? `/groups/${params.id}`
        : `/friends/${params.id}`
  ) as Href;

  function closePayment() {
    router.dismissTo(closeHref);
  }

  useEffect(() => {
    if (signedCanonicalMinor === undefined) return;
    const absolute =
      signedCanonicalMinor < 0n
        ? -signedCanonicalMinor
        : signedCanonicalMinor;
    setAmount(formatMinor(absolute, params.canonicalCurrency));
  }, [params.canonicalCurrency, params.canonicalMinor]);

  const create = api.settlements.create.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
        params.type === "group"
          ? utils.groups.detail.invalidate({ groupId: params.id })
          : utils.friends.detail.invalidate({
              friendshipId: params.friendshipId ?? params.id,
            }),
      ]);
      closePayment();
    },
  });

  const contextMembers = useMemo(() => {
    const candidates =
      params.type === "group"
        ? (group.data?.members ?? [])
        : [profile.data, friend.data?.friend];
    return candidates.flatMap((member): SettlementMember[] =>
      member
        ? [
            {
              userId: member.userId,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
              homeCurrency: member.homeCurrency as CurrencyCode,
            },
          ]
        : [],
    );
  }, [friend.data?.friend, group.data?.members, params.type, profile.data]);

  const fromMember = contextMembers.find(
    (member) => member.userId === fromUserId,
  );
  const toMember = contextMembers.find(
    (member) => member.userId === toUserId,
  );
  const sourceMinor = useMemo(() => {
    try {
      const parsed = parseDecimalToMinor(amount, currency);
      return parsed > 0n ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [amount, currency]);
  const rateTargets = useMemo(
    () =>
      [
        params.canonicalCurrency,
        fromMember?.homeCurrency,
        toMember?.homeCurrency,
      ].filter((value): value is CurrencyCode => Boolean(value)),
    [fromMember?.homeCurrency, params.canonicalCurrency, toMember?.homeCurrency],
  );
  const currentRateBasis = rateBasis(currency, rateTargets);
  const needsQuote = rateTargets.some((target) => target !== currency);
  const quoteReady =
    !needsQuote ||
    (activeQuote !== undefined && activeRateBasis === currentRateBasis);
  const conversionReady =
    sourceMinor !== undefined &&
    fromMember !== undefined &&
    toMember !== undefined &&
    fromMember.userId !== toMember.userId &&
    quoteReady;

  useEffect(() => {
    if (!profile.data || contextMembers.length < 2) return;
    const legacyNegative =
      signedCanonicalMinor !== undefined
        ? signedCanonicalMinor < 0n
        : false;
    const initialFrom =
      params.fromUserId ??
      (params.friendId
        ? legacyNegative
          ? profile.data.userId
          : params.friendId
        : profile.data.userId);
    const initialTo =
      params.toUserId ??
      (params.friendId
        ? legacyNegative
          ? params.friendId
          : profile.data.userId
        : contextMembers.find((member) => member.userId !== initialFrom)
            ?.userId);
    setFromUserId((current) => current || initialFrom);
    setToUserId((current) => current || initialTo || "");
  }, [
    contextMembers,
    params.friendId,
    params.fromUserId,
    params.toUserId,
    profile.data,
    signedCanonicalMinor,
  ]);

  useEffect(() => {
    if (sourceMinor === undefined || !fromMember || !toMember) {
      quoteRequest.current += 1;
      setRateStatus("idle");
      setRateError(undefined);
      return;
    }
    if (!needsQuote) {
      quoteRequest.current += 1;
      setActiveQuote(undefined);
      setActiveRateBasis(currentRateBasis);
      setRateStatus("ready");
      setRateError(undefined);
      return;
    }
    if (activeQuote && activeRateBasis === currentRateBasis) {
      setRateStatus("ready");
      setRateError(undefined);
      return;
    }

    const requestId = quoteRequest.current + 1;
    quoteRequest.current = requestId;
    setRateStatus("loading");
    setRateError(undefined);
    const timeout = setTimeout(() => {
      void requestQuote({
        base: currency,
        targets: [...new Set(rateTargets)],
      })
        .then((result) => {
          if (quoteRequest.current !== requestId) return;
          setActiveQuote(result);
          setActiveRateBasis(currentRateBasis);
          setRateStatus("ready");
        })
        .catch((cause: unknown) => {
          if (quoteRequest.current !== requestId) return;
          setActiveQuote(undefined);
          setActiveRateBasis("");
          setRateStatus("error");
          setRateError(
            cause instanceof Error
              ? cause.message
              : "Could not load exchange rates",
          );
        });
    }, 400);

    return () => {
      clearTimeout(timeout);
      if (quoteRequest.current === requestId) quoteRequest.current += 1;
    };
  }, [
    activeQuote,
    activeRateBasis,
    currency,
    currentRateBasis,
    fromMember,
    needsQuote,
    rateTargets,
    requestQuote,
    sourceMinor,
    toMember,
  ]);

  useEffect(() => {
    if (!activeQuote) return;
    const refreshIn =
      new Date(activeQuote.expiresAt).getTime() - Date.now() - 5_000;
    const timeout = setTimeout(() => {
      setActiveQuote(undefined);
      setActiveRateBasis("");
    }, Math.max(0, refreshIn));
    return () => clearTimeout(timeout);
  }, [activeQuote]);

  function clearQuote() {
    quoteRequest.current += 1;
    setActiveQuote(undefined);
    setActiveRateBasis("");
    setRateStatus("idle");
    setRateError(undefined);
  }

  function selectFrom(nextUserId: string) {
    setFromUserId(nextUserId);
    clearQuote();
  }

  function selectTo(nextUserId: string) {
    setToUserId(nextUserId);
    clearQuote();
  }

  function selectCurrency(nextCurrency: CurrencyCode) {
    setCurrency(nextCurrency);
    clearQuote();
  }

  function openCurrency() {
    beginCurrencySelection(
      currency,
      selectCurrency,
      [fromMember?.homeCurrency, toMember?.homeCurrency].filter(
        (value): value is CurrencyCode => Boolean(value),
      ),
    );
    router.push("/currency-picker");
  }

  function submit() {
    setFormError(undefined);
    if (!fromMember || !toMember || fromMember.userId === toMember.userId) {
      setFormError("Choose two different people");
      return;
    }
    if (sourceMinor === undefined) {
      setFormError("Enter a valid positive amount");
      return;
    }
    if (!quoteReady) {
      setFormError(rateError ?? "Wait for the currency conversion to update");
      return;
    }
    create.mutate({
      context:
        params.type === "group"
          ? { type: "group", groupId: params.id }
          : {
              type: "friend",
              friendshipId: params.friendshipId ?? params.id,
            },
      clientMutationId: Crypto.randomUUID(),
      fromUserId: fromMember.userId,
      toUserId: toMember.userId,
      amount: {
        currency,
        minor: sourceMinor.toString(),
      },
      canonicalCurrency: params.canonicalCurrency,
      occurredAt: new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12,
      ).toISOString(),
      notes: notes.trim(),
      ...(activeQuote ? { quoteId: activeQuote.id } : {}),
      rateOverrides: [],
    });
  }

  const convertedCanonical = useMemo(() => {
    if (
      sourceMinor === undefined ||
      currency === params.canonicalCurrency ||
      !activeQuote ||
      activeRateBasis !== currentRateBasis
    ) {
      return undefined;
    }
    const rate = activeQuote.rates.find(
      (candidate) => candidate.quote === params.canonicalCurrency,
    );
    if (!rate) return undefined;
    return formatConvertedMoney(
      convertMinor(
        sourceMinor,
        currency,
        params.canonicalCurrency,
        rate.rate,
      ),
      params.canonicalCurrency,
    );
  }, [
    activeQuote,
    activeRateBasis,
    currency,
    currentRateBasis,
    params.canonicalCurrency,
    sourceMinor,
  ]);

  const contextPending =
    profile.isPending ||
    (params.type === "group" ? group.isPending : friend.isPending);
  const contextError =
    profile.error ??
    (params.type === "group" ? group.error : friend.error);

  let content;
  if (contextPending) {
    content = <LoadingState />;
  } else if (contextError || contextMembers.length < 2) {
    content = (
      <ErrorState
        message={
          contextError?.message ??
          (params.type === "group"
            ? "This group needs at least two members"
            : "Friend not found")
        }
      />
    );
  } else {
    const conversionMetadata =
      rateStatus === "loading" ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          Updating conversion…
        </Text>
      ) : rateStatus === "error" ? (
        <Text selectable style={{ color: theme.negative, fontSize: 13 }}>
          {rateError ?? "Could not load exchange rates"}
        </Text>
      ) : convertedCanonical ? (
        <Text
          selectable
          style={{
            color: theme.primary,
            fontSize: 15,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          ≈ {convertedCanonical}
        </Text>
      ) : null;

    content = (
      <>
        <SettlementDirectionCard
          from={fromMember}
          to={toMember}
          viewerId={profile.data?.userId}
          members={contextMembers}
          onFromChange={selectFrom}
          onToChange={selectTo}
          locked={params.type === "friend"}
        />
        <SettlementAmountCard
          amount={amount}
          currency={currency}
          onAmountChange={setAmount}
          onCurrencyPress={openCurrency}
          {...(conversionMetadata ? { metadata: conversionMetadata } : {})}
        />

        <View style={{ gap: 10 }}>
          <Text
            style={{
              color: theme.text,
              paddingHorizontal: 4,
              fontSize: 20,
              fontWeight: "700",
              letterSpacing: -0.3,
            }}
          >
            Details
          </Text>
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
                  accessibilityLabel="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note…"
                  placeholderTextColor={theme.subtle}
                  selectionColor={theme.primary}
                  multiline
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
        {create.error ? <ErrorState message={create.error.message} /> : null}
      </>
    );
  }

  return (
    <>
      <Screen
        background="sheet"
        contentContainerStyle={{ paddingTop: 16, gap: 20 }}
        {...(!contextPending && !contextError && contextMembers.length >= 2
          ? {
              bottomOverlay: (
                <SettlementSaveControl
                  label={create.isPending ? "Saving…" : "Record payment"}
                  onPress={submit}
                  disabled={create.isPending || !conversionReady}
                />
              ),
              bottomOverlayHeight: 76,
            }
          : {})}
      >
        {content}
      </Screen>
      <Stack.Screen
        options={{
          title: "Record Payment",
          headerTitleAlign: "center",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton
                label="Cancel payment"
                glyph="×"
                disabled={create.isPending}
                onPress={closePayment}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Cancel payment"
          disabled={create.isPending}
          onPress={closePayment}
        />
      </Stack.Toolbar>
    </>
  );
}
