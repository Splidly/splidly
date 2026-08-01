import {
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type RateSnapshot,
} from "@splidly/shared";
import * as Crypto from "expo-crypto";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  ListRow,
  LoadingState,
  PrimaryButton,
  Screen,
} from "../../components/ui";
import { CurrencyField } from "../../components/currency-field";
import { api } from "../../lib/trpc";
import { useTheme } from "../../theme";

type SettlementMember = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  homeCurrency: CurrencyCode;
};

function MemberField({
  label,
  value,
  members,
  excludedUserId,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: SettlementMember | undefined;
  members: SettlementMember[];
  excludedUserId: string | undefined;
  onValueChange: (userId: string) => void;
  disabled?: boolean;
}) {
  const row = (
    <View accessibilityRole={disabled ? undefined : "button"}>
      <ListRow
        title={label}
        value={value?.displayName ?? "Choose person"}
        valueTone={value ? "default" : "muted"}
        showsDisclosureIndicator={false}
      />
    </View>
  );
  if (disabled) return row;

  const actions: MenuAction[] = members
    .filter((member) => member.userId !== excludedUserId)
    .map((member) => ({
      id: member.userId,
      title: member.displayName,
      state: member.userId === value?.userId ? "on" : "off",
    }));
  return (
    <MenuView
      title={label}
      actions={actions}
      testID={`settlement-${label.toLowerCase().replaceAll(" ", "-")}`}
      onPressAction={({ nativeEvent }) => onValueChange(nativeEvent.event)}
    >
      {row}
    </MenuView>
  );
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
  const [notes, setNotes] = useState("");
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  useEffect(() => {
    if (signedCanonicalMinor === undefined) return;
    const absolute =
      signedCanonicalMinor < 0n
        ? -signedCanonicalMinor
        : signedCanonicalMinor;
    setAmount(formatMinor(absolute, params.canonicalCurrency));
  }, [params.canonicalCurrency, params.canonicalMinor]);

  const quote = api.currency.quote.useMutation();
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
      router.back();
    },
  });
  const contextMembers = useMemo(
    () => {
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
    },
    [friend.data?.friend, group.data?.members, params.type, profile.data],
  );
  const fromMember = contextMembers.find(
    (member) => member.userId === fromUserId,
  );
  const toMember = contextMembers.find(
    (member) => member.userId === toUserId,
  );
  const contextCurrencies = [
    fromMember?.homeCurrency,
    toMember?.homeCurrency,
  ].filter((value): value is CurrencyCode => Boolean(value));

  useEffect(() => {
    if (!profile.data || contextMembers.length < 2) return;
    const legacyNegative = signedCanonicalMinor !== undefined
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

  function resetQuote() {
    quote.reset();
    setRateValues({});
  }

  function selectFrom(nextUserId: string) {
    setFromUserId(nextUserId);
    resetQuote();
  }

  function selectTo(nextUserId: string) {
    setToUserId(nextUserId);
    resetQuote();
  }

  async function preview() {
    setFormError(undefined);
    if (!fromMember || !toMember || fromMember.userId === toMember.userId) {
      setFormError("Choose two different people");
      return;
    }
    try {
      parseDecimalToMinor(amount, currency);
      const result = await quote.mutateAsync({
        base: currency,
        targets: [
          params.canonicalCurrency,
          fromMember.homeCurrency,
          toMember.homeCurrency,
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
  if (contextError || contextMembers.length < 2) {
    return (
      <Screen background="sheet">
        <ErrorState
          message={
            contextError?.message ??
            (params.type === "group"
              ? "This group needs at least two members"
              : "Friend not found")
          }
        />
      </Screen>
    );
  }

  return (
    <Screen background="sheet">
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        {fromMember && toMember ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar
              name={fromMember.displayName}
              colorKey={fromMember.userId}
              imageUrl={fromMember.avatarUrl}
              size={54}
            />
            <Text style={{ color: theme.muted, fontSize: 22 }}>→</Text>
            <Avatar
              name={toMember.displayName}
              colorKey={toMember.userId}
              imageUrl={toMember.avatarUrl}
              size={54}
            />
          </View>
        ) : null}
        <Text
          style={{
            color: theme.text,
            fontSize: 24,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {fromMember && toMember
            ? fromMember.userId === profile.data?.userId
              ? `You paid ${toMember.displayName}`
              : toMember.userId === profile.data?.userId
                ? `${fromMember.displayName} paid you`
                : `${fromMember.displayName} paid ${toMember.displayName}`
            : "Record payment"}
        </Text>
      </View>
      <FormSection title="Payment">
        <MemberField
          label="Paid by"
          value={fromMember}
          members={contextMembers}
          excludedUserId={toUserId}
          onValueChange={selectFrom}
          disabled={params.type === "friend"}
        />
        <MemberField
          label="Paid to"
          value={toMember}
          members={contextMembers}
          excludedUserId={fromUserId}
          onValueChange={selectTo}
          disabled={params.type === "friend"}
        />
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <CurrencyField
          label="Currency"
          value={currency}
          onValueChange={(value) => {
            setCurrency(value);
            resetQuote();
          }}
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
        disabled={
          quote.isPending ||
          !fromMember ||
          !toMember ||
          fromUserId === toUserId
        }
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
