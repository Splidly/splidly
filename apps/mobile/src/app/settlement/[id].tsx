import type { CurrencyCode } from "@splidly/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { SettlementDirectionCard, type SettlementMember } from "../../components/settlement-composer";
import {
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  RowDivider,
  Screen,
  Section,
  SheetCaption,
} from "../../components/ui";
import { expenseTotalInCurrency } from "../../lib/expense-detail";
import { formatMoney } from "../../lib/money-display";
import { toolbarIcons } from "../../lib/toolbar-icons";
import { api } from "../../lib/trpc";
import { useNavigationPressGuard } from "../../lib/use-navigation-press-guard";
import { useTheme } from "../../theme";

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const acceptEdit = useNavigationPressGuard();
  const detail = api.settlements.detail.useQuery({ settlementId: id });
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const remove = api.settlements.remove.useMutation({
    async onSuccess() {
      const settlement = detail.data?.settlement;
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.friends.detail.invalidate(),
        utils.groups.list.invalidate(),
        settlement?.groupId
          ? utils.groups.detail.invalidate({ groupId: settlement.groupId })
          : Promise.resolve(),
        settlement?.groupId
          ? utils.groups.balances.invalidate({ groupId: settlement.groupId })
          : Promise.resolve(),
      ]);
      router.back();
    },
  });

  function editPayment() {
    const settlement = detail.data?.settlement;
    if (!settlement || !profile.data || remove.isPending || !acceptEdit()) return;
    const friendId = settlement.fromUserId === profile.data?.userId
      ? settlement.toUserId
      : settlement.fromUserId;
    router.push({
      pathname: "/settlement/new",
      params: {
        type: settlement.groupId ? "group" : "friend",
        id: settlement.groupId ?? settlement.friendshipId!,
        ...(settlement.friendshipId ? { friendshipId: settlement.friendshipId, friendId } : {}),
        canonicalCurrency: settlement.canonicalCurrency,
        settlementId: settlement.id,
        returnToDetail: "true",
      },
    });
  }

  function confirmDelete() {
    const settlement = detail.data?.settlement;
    if (!settlement || remove.isPending) return;
    Alert.alert("Delete payment?", "This payment will be removed and its balances will be reversed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove.mutate({ settlementId: settlement.id, expectedVersion: settlement.version }),
      },
    ]);
  }

  const data = detail.data;
  let content;
  if (detail.isPending) content = <LoadingState />;
  else if (detail.error || !data) {
    content = <ErrorState message={detail.error?.message} onRetry={() => void detail.refetch()} />;
  } else {
    const { settlement, from, to, rates } = data;
    const currency = settlement.sourceCurrency as CurrencyCode;
    const homeCurrency = profile.data?.homeCurrency as CurrencyCode | undefined;
    const homeAmount = homeCurrency && homeCurrency !== currency
      ? expenseTotalInCurrency(settlement.sourceAmountMinor, currency, homeCurrency, rates)
      : undefined;
    const person = (userId: string, value: typeof from): SettlementMember => ({
      userId,
      displayName: value?.displayName ?? "Deleted user",
      avatarUrl: value?.avatarUrl ?? null,
      homeCurrency: (value?.homeCurrency ?? settlement.canonicalCurrency) as CurrencyCode,
    });
    content = (
      <>
        <View style={{ backgroundColor: theme.sheetSurface, borderRadius: 24, borderCurve: "continuous" }}>
          <SettlementDirectionCard
            from={person(settlement.fromUserId, from)}
            to={person(settlement.toUserId, to)}
            viewerId={profile.data?.userId}
            members={[]}
            locked
            onFromChange={() => {}}
            onToChange={() => {}}
          />
          <RowDivider inset={18} />
          <View style={{ padding: 18, gap: 6 }}>
            <Text selectable={false} style={{ color: theme.muted, fontSize: 13 }}>Amount</Text>
            <Text selectable={false} style={{ color: theme.text, fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {formatMoney(settlement.sourceAmountMinor, currency)}
            </Text>
            {homeAmount !== undefined && homeCurrency ? (
              <Text selectable={false} style={{ color: theme.muted, fontSize: 14 }}>
                ≈ {formatMoney(homeAmount, homeCurrency)}
              </Text>
            ) : null}
          </View>
        </View>
        <Section title="Details" surface="sheet">
          <ListRow title="Date" value={new Date(settlement.occurredAt).toLocaleDateString(undefined, { dateStyle: "medium" })} />
          {settlement.notes ? (
            <>
              <RowDivider inset={16} />
              <View style={{ padding: 16, gap: 6 }}>
                <Text selectable={false} style={{ color: theme.muted, fontSize: 13 }}>Note</Text>
                <Text selectable={false} style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>{settlement.notes}</Text>
              </View>
            </>
          ) : null}
        </Section>
        <Section surface="sheet">
          <ListRow
            title={remove.isPending ? "Deleting…" : "Delete payment"}
            destructive
            showsDisclosureIndicator={false}
            {...(remove.isPending ? {} : { onPress: confirmDelete })}
          />
        </Section>
        {remove.error ? <ErrorState message={remove.error.message} /> : null}
      </>
    );
  }

  return (
    <>
      <Screen background="groupedSheet" formSheetBottomClearance contentContainerStyle={{ paddingTop: 8, gap: 16 }}>
        {process.env.EXPO_OS === "android" ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <HeaderButton label="Close payment details" glyph="×" onPress={() => router.back()} />
            <HeaderButton label="Edit payment" glyph="Edit" disabled={!data || !profile.data || remove.isPending} onPress={editPayment} />
          </View>
        ) : null}
        <SheetCaption>Payment details</SheetCaption>
        {content}
        {profile.error ? <ErrorState message={profile.error.message} /> : null}
      </Screen>
      <Stack.Screen options={{
        title: "Payment",
        ...(process.env.EXPO_OS === "android" ? { headerShown: false } : {}),
      }} />
      {process.env.EXPO_OS !== "android" ? <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon={toolbarIcons.close} accessibilityLabel="Close payment details" onPress={() => router.back()} />
      </Stack.Toolbar> : null}
      {process.env.EXPO_OS !== "android" ? <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon={toolbarIcons.edit} accessibilityLabel="Edit payment" disabled={!data || !profile.data || remove.isPending} onPress={editPayment} />
      </Stack.Toolbar> : null}
    </>
  );
}
