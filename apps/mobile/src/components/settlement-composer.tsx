import type { CurrencyCode } from "@splidly/shared";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { Avatar, PrimaryButton } from "./ui";

export type SettlementMember = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  homeCurrency: CurrencyCode;
};

function PartyChoice({
  label,
  value,
  viewerId,
  members,
  excludedUserId,
  onValueChange,
  disabled,
  testID,
}: {
  label: string;
  value: SettlementMember | undefined;
  viewerId: string | undefined;
  members: SettlementMember[];
  excludedUserId: string | undefined;
  onValueChange: (userId: string) => void;
  disabled: boolean;
  testID: string;
}) {
  const theme = useTheme();
  const name = value
    ? value.userId === viewerId
      ? "You"
      : value.displayName
    : "Choose";
  const content = (
    <View
      accessible
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={`${label}: ${name}`}
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: "center",
        gap: 7,
        paddingVertical: 2,
      }}
    >
      {value ? (
        <Avatar
          name={value.displayName}
          colorKey={value.userId}
          imageUrl={value.avatarUrl}
          size={58}
        />
      ) : (
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.elevated,
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 26 }}>?</Text>
        </View>
      )}
      <View style={{ alignItems: "center", gap: 2, maxWidth: "100%" }}>
        <Text
          style={{
            color: theme.muted,
            fontSize: 11,
            lineHeight: 15,
            fontWeight: "700",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}
        >
          {name}
        </Text>
      </View>
    </View>
  );

  if (disabled) return content;
  const actions: MenuAction[] = members
    .filter((member) => member.userId !== excludedUserId)
    .map((member) => ({
      id: member.userId,
      title: member.userId === viewerId ? "You" : member.displayName,
      state: member.userId === value?.userId ? "on" : "off",
    }));
  return (
    <MenuView
      title={label}
      actions={actions}
      testID={testID}
      onPressAction={({ nativeEvent }) => onValueChange(nativeEvent.event)}
    >
      {content}
    </MenuView>
  );
}

export function SettlementDirectionCard({
  from,
  to,
  viewerId,
  members,
  onFromChange,
  onToChange,
  locked,
}: {
  from: SettlementMember | undefined;
  to: SettlementMember | undefined;
  viewerId: string | undefined;
  members: SettlementMember[];
  onFromChange: (userId: string) => void;
  onToChange: (userId: string) => void;
  locked: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: 146,
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 8px 28px rgba(0, 0, 0, 0.08)",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <PartyChoice
        label="Paid by"
        value={from}
        viewerId={viewerId}
        members={members}
        excludedUserId={to?.userId}
        onValueChange={onFromChange}
        disabled={locked}
        testID="settlement-paid-by"
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.elevated,
        }}
      >
        <Text
          style={{
            color: theme.primary,
            fontSize: 21,
            lineHeight: 24,
            fontWeight: "700",
          }}
        >
          →
        </Text>
      </View>
      <PartyChoice
        label="Paid to"
        value={to}
        viewerId={viewerId}
        members={members}
        excludedUserId={from?.userId}
        onValueChange={onToChange}
        disabled={locked}
        testID="settlement-paid-to"
      />
    </View>
  );
}

export function SettlementAmountCard({
  amount,
  currency,
  onAmountChange,
  onCurrencyPress,
  metadata,
}: {
  amount: string;
  currency: CurrencyCode;
  onAmountChange: (value: string) => void;
  onCurrencyPress: () => void;
  metadata?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 18,
        paddingVertical: 16,
        gap: 8,
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 8px 28px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Text
        style={{
          color: theme.muted,
          fontSize: 11,
          lineHeight: 15,
          fontWeight: "700",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        Amount
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TextInput
          accessibilityLabel="Amount"
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.subtle}
          selectionColor={theme.primary}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            color: theme.text,
            fontSize: 42,
            lineHeight: 50,
            fontWeight: "700",
            letterSpacing: -1.5,
            fontVariant: ["tabular-nums"],
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Currency"
          accessibilityHint={`Currently ${currency}`}
          onPress={onCurrencyPress}
          style={({ pressed }) => ({
            minHeight: 42,
            paddingHorizontal: 14,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.elevated,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text
            style={{ color: theme.primary, fontSize: 16, fontWeight: "700" }}
          >
            {currency}⌄
          </Text>
        </Pressable>
      </View>
      {metadata}
    </View>
  );
}

export function SettlementSaveControl({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        width: width - 32,
        padding: 6,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
      }}
    >
      <PrimaryButton label={label} onPress={onPress} disabled={disabled} />
    </View>
  );
}
