import type { TextInputInstance } from "react-native";
import type { CurrencyCode } from "@splidly/shared";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import { useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { DropdownChevron } from "./dropdown-chevron";
import { Avatar, PrimaryButton, RowDivider } from "./ui";

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
  onValueChange,
  disabled,
  testID,
  width,
  compact = false,
}: {
  label: string;
  value: SettlementMember | undefined;
  viewerId: string | undefined;
  members: SettlementMember[];
  onValueChange: (userId: string) => void;
  disabled: boolean;
  testID: string;
  width: number;
  compact?: boolean;
}) {
  const theme = useTheme();
  const name = value
    ? value.userId === viewerId
      ? "You"
      : value.displayName
    : "Choose";
  const content = compact ? (
    <View
      accessible
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={`${label}: ${name}`}
      pointerEvents={process.env.EXPO_OS === "android" && !disabled ? "none" : "auto"}
      style={{
        width: width > 0 ? width : "100%",
        minHeight: 54,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text selectable={false} style={{ color: theme.muted, fontSize: 15 }}>
        {label}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        style={{ flex: 1, textAlign: "right", color: theme.text, fontSize: 16 }}
      >
        {name}
      </Text>
      {!disabled ? (
        <View pointerEvents="none">
          <DropdownChevron color={theme.primary} testID={`${testID}-chevron`} />
        </View>
      ) : null}
    </View>
  ) : (
    <View
      accessible
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={`${label}: ${name}`}
      pointerEvents={process.env.EXPO_OS === "android" && !disabled ? "none" : "auto"}
      style={{
        width: width > 0 ? width : "100%",
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
          <Text selectable={false} style={{ color: theme.muted, fontSize: 26 }}>?</Text>
        </View>
      )}
      <View style={{ alignItems: "center", gap: 2, maxWidth: "100%" }}>
        <Text selectable={false}
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
        <Text selectable={false}
          numberOfLines={1}
          style={{ color: theme.text, fontSize: 17, fontWeight: "700", textAlign: "center" }}
        >
          {name}
        </Text>
      </View>
    </View>
  );

  if (disabled) return content;
  const actions: MenuAction[] = [...members]
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      }),
    )
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
      style={width > 0 ? { width } : { width: "100%" }}
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
  compact = false,
}: {
  from: SettlementMember | undefined;
  to: SettlementMember | undefined;
  viewerId: string | undefined;
  members: SettlementMember[];
  onFromChange: (userId: string) => void;
  onToChange: (userId: string) => void;
  locked: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const [slotWidth, setSlotWidth] = useState(0);
  if (compact) {
    return (
      <View>
        <View
          testID="settlement-paid-by-slot"
          onLayout={({ nativeEvent: { layout: { width } } }) => setSlotWidth(width)}
        >
          <PartyChoice
            label="Paid by"
            value={from}
            viewerId={viewerId}
            members={members}
            onValueChange={onFromChange}
            disabled={locked}
            testID="settlement-paid-by"
            width={slotWidth}
            compact
          />
        </View>
        <RowDivider inset={16} />
        <View testID="settlement-paid-to-slot">
          <PartyChoice
            label="Paid to"
            value={to}
            viewerId={viewerId}
            members={members}
            onValueChange={onToChange}
            disabled={locked}
            testID="settlement-paid-to"
            width={slotWidth}
            compact
          />
        </View>
      </View>
    );
  }
  return (
    <View
      style={{
        minHeight: 146,
        paddingHorizontal: 16,
        paddingVertical: 18,
        backgroundColor: "transparent",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <View
        testID="settlement-paid-by-slot"
        style={{ flex: 1, minWidth: 0, alignItems: "center" }}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setSlotWidth((current) => current === width ? current : width);
        }}
      >
        <PartyChoice
          label="Paid by"
          value={from}
          viewerId={viewerId}
          members={members}
          onValueChange={onFromChange}
          disabled={locked}
          testID="settlement-paid-by"
          width={slotWidth}
        />
      </View>
      <View
        testID="settlement-direction-arrow"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          marginTop: 13,
          backgroundColor: theme.elevated,
        }}
      >
        <Text selectable={false}
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
      <View testID="settlement-paid-to-slot" style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
        <PartyChoice
          label="Paid to"
          value={to}
          viewerId={viewerId}
          members={members}
          onValueChange={onToChange}
          disabled={locked}
          testID="settlement-paid-to"
          width={slotWidth}
        />
      </View>
    </View>
  );
}

export function SettlementAmountCard({
  amount,
  currency,
  onAmountChange,
  onAmountBlur,
  onCurrencyPress,
  metadata,
  onAmountFocus,
  onAmountBlurInput,
}: {
  amount: string;
  currency: CurrencyCode;
  onAmountChange: (value: string) => void;
  onAmountBlur?: () => void;
  onCurrencyPress: () => void;
  metadata?: ReactNode;
  onAmountFocus?: (input: TextInputInstance | null) => void;
  onAmountBlurInput?: (input: TextInputInstance | null) => void;
}) {
  const theme = useTheme();
  const amountInputRef = useRef<TextInputInstance>(null);
  return (
    <View
      style={{
        paddingHorizontal: 18,
        paddingVertical: 16,
        gap: 8,
        backgroundColor: "transparent",
      }}
    >
      <Text selectable={false}
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
          ref={amountInputRef}
          accessibilityLabel="Amount"
          value={amount}
          onChangeText={onAmountChange}
          onFocus={() => onAmountFocus?.(amountInputRef.current)}
          onBlur={() => {
            onAmountBlur?.();
            onAmountBlurInput?.(amountInputRef.current);
          }}
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
            minHeight: 48,
            minWidth: 48,
            paddingHorizontal: 14,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.elevated,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <View
            pointerEvents="none"
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text selectable={false}
              style={{ color: theme.primary, fontSize: 16, fontWeight: "700" }}
            >
              {currency}
            </Text>
            <DropdownChevron color={theme.primary} />
          </View>
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
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 768,
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
