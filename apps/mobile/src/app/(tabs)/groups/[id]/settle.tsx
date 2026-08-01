import type { CurrencyCode } from "@splidly/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import {
  Avatar,
  ErrorState,
  FormSection,
  ListRow,
  LoadingState,
  PrimaryButton,
  Screen,
  SheetCloseButton,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";
import { formatConvertedMoney } from "../../../../lib/money-display";
import { useTheme } from "../../../../theme";

export default function SettleGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
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

  return (
    <Screen background="sheet">
      <SheetCloseButton
        label="Close settle up"
        onPress={() => router.back()}
      />
      <View style={{ paddingVertical: 8, gap: 4 }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: -0.6,
          }}
        >
          Settle up
        </Text>
      </View>

      {memberBalances.length > 0 ? (
        <FormSection title="Open balances">
          {memberBalances.map((memberBalance) => {
            const signedMinor = BigInt(memberBalance.balance.minor);
            const viewerPays = signedMinor < 0n;
            const absoluteMinor = viewerPays ? -signedMinor : signedMinor;
            return (
              <ListRow
                key={memberBalance.userId}
                title={
                  viewerPays
                    ? `You pay ${memberBalance.displayName}`
                    : `${memberBalance.displayName} pays you`
                }
                value={formatConvertedMoney(
                  absoluteMinor,
                  memberBalance.balance.currency as CurrencyCode,
                )}
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
                    },
                  })
                }
              />
            );
          })}
        </FormSection>
      ) : null}

      <PrimaryButton
        label="Custom payment"
        tone="secondary"
        disabled={members.length < 2}
        onPress={() =>
          router.replace({
            pathname: "/settlement/new",
            params: {
              type: "group",
              id: group.id,
              fromUserId: profile.data.userId,
              canonicalCurrency: group.currency,
            },
          })
        }
      />
    </Screen>
  );
}
