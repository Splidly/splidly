import {
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type RateSnapshot,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  Intro,
  LoadingState,
  PrimaryButton,
  Screen,
} from "../../components/ui";
import { CurrencyField } from "../../components/currency-field";
import { api } from "../../lib/trpc";
import { useTheme } from "../../theme";

export default function NewSettlementScreen() {
  const params = useLocalSearchParams<{
    type: "group" | "friend";
    id: string;
    friendshipId?: string;
    friendId: string;
    canonicalCurrency: CurrencyCode;
    canonicalMinor: string;
  }>();
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const friend = api.friends.detail.useQuery(
    {
      friendshipId: params.friendshipId ?? "",
    },
    {
      enabled:
        params.type === "friend" && Boolean(params.friendshipId),
    },
  );
  const group = api.groups.detail.useQuery(
    { groupId: params.id },
    { enabled: params.type === "group" },
  );
  const utils = api.useUtils();
  const negative = BigInt(params.canonicalMinor) < 0n;
  const absolute = negative
    ? -BigInt(params.canonicalMinor)
    : BigInt(params.canonicalMinor);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(params.canonicalCurrency);
  const [notes, setNotes] = useState("");
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  useEffect(() => {
    setAmount(formatMinor(absolute, params.canonicalCurrency));
  }, [absolute, params.canonicalCurrency]);

  const quote = api.currency.quote.useMutation();
  const create = api.settlements.create.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
        params.type === "group"
          ? utils.groups.detail.invalidate({ groupId: params.id })
          : utils.friends.detail.invalidate({
              friendshipId: params.id,
            }),
      ]);
      router.back();
    },
  });
  const fromUserId = negative ? profile.data?.userId : params.friendId;
  const toUserId = negative ? params.friendId : profile.data?.userId;
  const counterparty =
    params.type === "group"
      ? group.data?.members.find(
          (member) => member.userId === params.friendId,
        )
      : friend.data?.friend;
  const friendName = counterparty?.displayName ?? "Your friend";
  const contextCurrencies = [
    counterparty?.homeCurrency,
    profile.data?.homeCurrency,
  ].filter((value): value is CurrencyCode => Boolean(value));

  async function preview() {
    setFormError(undefined);
    if (!profile.data || !counterparty) return;
    try {
      parseDecimalToMinor(amount, currency);
      const result = await quote.mutateAsync({
        base: currency,
        targets: [
          params.canonicalCurrency,
          profile.data.homeCurrency,
          counterparty.homeCurrency,
        ],
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
    if (!quote.data || !fromUserId || !toUserId) return;
    try {
      const automatic = quote.data.rates;
      const rateOverrides: RateSnapshot[] = automatic
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
        fromUserId,
        toUserId,
        amount: {
          currency,
          minor: parseDecimalToMinor(amount, currency).toString(),
        },
        canonicalCurrency: params.canonicalCurrency,
        occurredAt: new Date().toISOString(),
        notes: notes.trim(),
        quoteId: quote.data.id,
        rateOverrides,
      });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Check the amount");
    }
  }

  const contextPending =
    profile.isPending ||
    (params.type === "group" ? group.isPending : friend.isPending);
  const contextError =
    profile.error ??
    (params.type === "group" ? group.error : friend.error);
  if (contextPending) {
    return (
      <Screen background="sheet">
        <LoadingState />
      </Screen>
    );
  }
  if (contextError || !counterparty) {
    return (
      <Screen background="sheet">
        <ErrorState
          message={
            contextError?.message ??
            (params.type === "group"
              ? "Group member not found"
              : "Friend not found")
          }
        />
      </Screen>
    );
  }

  return (
    <Screen background="sheet">
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <Avatar
          name={friendName}
          colorKey={counterparty.userId}
          size={68}
        />
        <Text
          style={{
            color: theme.text,
            fontSize: 24,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {negative ? `You paid ${friendName}` : `${friendName} paid you`}
        </Text>
      </View>
      <Intro>
        Record a payment that already happened. Splidly updates the ledger but
        never moves money.
      </Intro>
      <FormSection title="Payment">
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <CurrencyField
          label="Currency"
          value={currency}
          onValueChange={setCurrency}
          recentCurrencies={contextCurrencies}
        />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Optional"
        />
      </FormSection>
      <PrimaryButton
        label={quote.isPending ? "Getting rate…" : "Preview conversion"}
        tone="secondary"
        onPress={() => void preview()}
        disabled={quote.isPending || !fromUserId || !toUserId}
      />
      {quote.data ? (
        <FormSection
          title="Frozen exchange rates"
          footer="Any edits are saved as manual overrides with this settlement."
        >
          {quote.data.rates.map((rate) => (
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
        label={create.isPending ? "Saving…" : "Record settlement"}
        onPress={submit}
        disabled={!quote.data || create.isPending}
      />
      {formError ? <ErrorState message={formError} /> : null}
      {quote.error ? <ErrorState message={quote.error.message} /> : null}
      {create.error ? <ErrorState message={create.error.message} /> : null}
    </Screen>
  );
}
