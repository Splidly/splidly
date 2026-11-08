import type { CurrencyCode } from "@splidly/shared";
import { Host, Icon } from "@expo/ui";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { View, useColorScheme } from "react-native";
import {
  Avatar,
  ErrorState,
  FormSection,
  HeaderButton,
  Intro,
  ListRow,
  LoadingState,
  Screen,
  SheetCaption,
} from "../../components/ui";
import type { ActivityListRow, ActivityListSection } from "../../components/native-activity-list.types";
import { nativeUserAvatar } from "../../components/native-avatar";
import { ExpenseBalanceStatus } from "../../components/expense-list-involvement";
import { useNavigationPressGuard } from "../../lib/use-navigation-press-guard";
import { formatConvertedMoney } from "../../lib/money-display";
import { api } from "../../lib/trpc";
import { toolbarIcons } from "../../lib/toolbar-icons";
import { useTheme } from "../../theme";

const customPaymentIcon = Icon.select({
  ios: "arrow.left.arrow.right",
  android: import("@expo/material-symbols/account_balance_wallet.xml"),
});

function CustomPaymentIcon() {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      pointerEvents="none"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.elevated,
      }}
    >
      <Host
        matchContents
        ignoreSafeArea="all"
        style={{ width: 19, height: 19 }}
      >
        <Icon
          name={customPaymentIcon}
          size={19}
          color={theme.primary}
          accessibilityLabel="Custom payment"
        />
      </Host>
    </View>
  );
}

export default function SettleGroupScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: "balances" | "settings";
  }>();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const theme = useTheme();
  const canNavigate = useNavigationPressGuard();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const profile = api.profile.me.useQuery();

  if (detail.isPending || profile.isPending) {
    return (
      <Screen background="sheet">
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || profile.error || !detail.data || !profile.data) {
    return (
      <Screen background="sheet">
        <ErrorState
          message={
            detail.error?.message ??
            profile.error?.message ??
            "Could not load this group"
          }
          onRetry={() => {
            void detail.refetch();
            void profile.refetch();
          }}
        />
      </Screen>
    );
  }

  const { group, memberBalances, members } = detail.data;
  const closeHref = (
    returnTo === "balances"
      ? `/groups/${id}/balances`
      : returnTo === "settings"
        ? `/groups/${id}/settings`
        : `/groups/${id}`
  ) as Href;

  const close = () => { if (canNavigate()) router.dismissTo(closeHref); };
  const viewerId = profile.data.userId;
  const payments = memberBalances.flatMap(memberBalance => {
    const signedMinor = BigInt(memberBalance.balance.minor);
    if (signedMinor === 0n) return [];
    const viewerPays = signedMinor < 0n;
    const absoluteMinor = viewerPays ? -signedMinor : signedMinor;
    return [{
      ...memberBalance,
      label: viewerPays ? "You pay" : "You receive",
      amount: { minor: absoluteMinor.toString(), currency: memberBalance.balance.currency as CurrencyCode },
      color: viewerPays ? theme.negative : theme.positive,
      accessibilityLabel: viewerPays
        ? `Pay ${memberBalance.displayName} ${formatConvertedMoney(absoluteMinor, memberBalance.balance.currency as CurrencyCode)}`
        : `Receive ${formatConvertedMoney(absoluteMinor, memberBalance.balance.currency as CurrencyCode)} from ${memberBalance.displayName}`,
      onPress: () => {
        if (!canNavigate()) return;
        router.replace({ pathname: "/settlement/new", params: {
          type: "group", id: group.id,
          fromUserId: viewerPays ? viewerId : memberBalance.userId,
          toUserId: viewerPays ? memberBalance.userId : viewerId,
          canonicalCurrency: memberBalance.balance.currency,
          canonicalMinor: absoluteMinor.toString(),
          ...(returnTo ? { returnTo } : {}),
        } });
      },
    }];
  });
  const canRecordPayment = members.length >= 2;
  const openCustomPayment = () => {
    if (!canRecordPayment || !canNavigate()) return;
    router.replace({ pathname: "/settlement/new", params: {
      type: "group", id: group.id, fromUserId: viewerId,
      canonicalCurrency: group.currency, ...(returnTo ? { returnTo } : {}),
    } });
  };
  const customSubtitle = canRecordPayment ? "Choose people and amount" : "Add another member to record a payment";
  const nativePayments: ActivityListRow[] = payments.length ? payments.map(payment => ({
    key: `payment:${payment.userId}:${payment.balance.currency}`, nativeContent: true, content: null,
    onPress: payment.onPress,
    settings: {
      title: payment.displayName, symbol: "", identity: false, avatar: true,
      avatarFallback: nativeUserAvatar(payment.displayName, payment.userId, scheme),
      ...(payment.avatarUrl ? { imageUri: payment.avatarUrl } : {}),
      enabled: true, destructive: false, showsDisclosure: true,
      balances: [{ label: payment.label, value: formatConvertedMoney(BigInt(payment.amount.minor), payment.amount.currency), color: payment.color }],
    },
  })) : [{
    key: "settled", nativeContent: true, content: null,
    settings: { title: "All settled up", subtitle: "No open balances", symbol: "checkmark.circle",
      identity: false, enabled: true, destructive: false, showsDisclosure: false },
  }];
  const sections: ActivityListSection[] = [
    { key: "suggested", label: group.name, nativeHeader: true, data: nativePayments },
    { key: "custom", label: "", nativeHeader: true, data: [{
      key: "custom-payment", nativeContent: true, content: null,
      ...(canRecordPayment ? { onPress: openCustomPayment } : {}),
      settings: { title: "Custom payment", subtitle: customSubtitle, symbol: "arrow.left.arrow.right",
        identity: false, enabled: canRecordPayment, destructive: false, showsDisclosure: canRecordPayment },
    }] },
  ];

  return (
    <>
      {process.env.EXPO_OS === "ios" ? <Screen background="sheet" activityList={{ sections }} /> : (
        <Screen background="sheet">
          <SheetCaption>Settle up</SheetCaption>
          <Intro>{group.name}</Intro>
          <FormSection title="Suggested payments">
            {payments.length ? payments.map(payment => <ListRow
              key={`${payment.userId}:${payment.balance.currency}`}
              title={payment.displayName} accessibilityLabel={payment.accessibilityLabel}
              accessibilityHint="Opens a prefilled payment"
              leading={<Avatar name={payment.displayName} colorKey={payment.userId} imageUrl={payment.avatarUrl} size={40} />}
              trailing={<ExpenseBalanceStatus label={payment.label} amount={payment.amount} color={payment.color} />}
              onPress={payment.onPress}
            />) : <ListRow title="All settled up" subtitle="No open balances" showsDisclosureIndicator={false} />}
          </FormSection>
          <FormSection>
            <ListRow title="Custom payment" subtitle={customSubtitle} leading={<CustomPaymentIcon />}
              showsDisclosureIndicator={canRecordPayment}
              {...(canRecordPayment ? { onPress: openCustomPayment } : {})} />
          </FormSection>
        </Screen>
      )}
      <Stack.Screen
        options={{
          title: "Settle Up",
          headerTitleAlign: "center",
          ...(process.env.EXPO_OS === "ios" && {
            sheetAllowedDetents: [0.5, 1],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
          }),
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton label="Close settle up" glyph="×" onPress={close} />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={toolbarIcons.close}
          accessibilityLabel="Close settle up"
          onPress={close}
        />
      </Stack.Toolbar>
    </>
  );
}
