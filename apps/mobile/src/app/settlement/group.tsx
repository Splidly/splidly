import type { CurrencyCode } from "@splidly/shared";
import { Host, Icon } from "@expo/ui";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  ErrorState,
  FormSection,
  HeaderButton,
  Intro,
  ListRow,
  LoadingState,
  Screen,
} from "../../components/ui";
import { formatConvertedMoney } from "../../lib/money-display";
import { api } from "../../lib/trpc";
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

  const close = () => router.dismissTo(closeHref);

  return (
    <>
      <Screen
        background="sheet"
        contentContainerStyle={{ paddingTop: 12, gap: 24 }}
      >
        <Intro>
          Choose an open balance in {group.name}, or record a different
          payment.
        </Intro>

        {memberBalances.length > 0 ? (
          <FormSection
            title="Suggested payments"
            footer="Select a person to open a prefilled payment."
          >
            {memberBalances.map((memberBalance) => {
              const signedMinor = BigInt(memberBalance.balance.minor);
              const viewerPays = signedMinor < 0n;
              const absoluteMinor = viewerPays ? -signedMinor : signedMinor;
              const amount = formatConvertedMoney(
                absoluteMinor,
                memberBalance.balance.currency as CurrencyCode,
              );
              return (
                <ListRow
                  key={memberBalance.userId}
                  accessibilityLabel={
                    viewerPays
                      ? `Pay ${memberBalance.displayName} ${amount}`
                      : `Receive ${amount} from ${memberBalance.displayName}`
                  }
                  accessibilityHint="Opens a prefilled payment"
                  title={memberBalance.displayName}
                  subtitle={viewerPays ? "You pay" : "Pays you"}
                  value={amount}
                  valueTone={viewerPays ? "negative" : "positive"}
                  leading={
                    <Avatar
                      name={memberBalance.displayName}
                      colorKey={memberBalance.userId}
                      imageUrl={memberBalance.avatarUrl}
                    />
                  }
                  onPress={() =>
                    router.replace({
                      pathname: "/settlement/new",
                      params: {
                        type: "group",
                        id: group.id,
                        fromUserId: viewerPays
                          ? profile.data.userId
                          : memberBalance.userId,
                        toUserId: viewerPays
                          ? memberBalance.userId
                          : profile.data.userId,
                        canonicalCurrency: memberBalance.balance.currency,
                        canonicalMinor: absoluteMinor.toString(),
                        ...(returnTo ? { returnTo } : {}),
                      },
                    })
                  }
                />
              );
            })}
          </FormSection>
        ) : (
          <FormSection>
            <ListRow
              title="Everyone is settled up"
              subtitle="There are no suggested payments"
              showsDisclosureIndicator={false}
            />
          </FormSection>
        )}

        <FormSection title="Other">
          <ListRow
            title="Custom payment"
            subtitle="Choose people, amount, and currency"
            leading={<CustomPaymentIcon />}
            {...(members.length >= 2
              ? {
                  onPress: () =>
                    router.replace({
                      pathname: "/settlement/new",
                      params: {
                        type: "group",
                        id: group.id,
                        fromUserId: profile.data.userId,
                        canonicalCurrency: group.currency,
                        ...(returnTo ? { returnTo } : {}),
                      },
                    }),
                }
              : {
                  value: "Unavailable",
                  valueTone: "muted" as const,
                })}
          />
        </FormSection>
      </Screen>
      <Stack.Screen
        options={{
          title: "Settle Up",
          headerTitleAlign: "center",
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton label="Close settle up" glyph="×" onPress={close} />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Close settle up"
          onPress={close}
        />
      </Stack.Toolbar>
    </>
  );
}
