import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ColorValue,
} from "react-native";
import { useTheme } from "../theme";
import { DropdownChevron } from "./dropdown-chevron";
import { PrimaryButton } from "./ui";

export function ExpenseEntryCard({
  icon,
  description,
  onDescriptionChange,
  amount,
  onAmountChange,
  onAmountBlur,
  currency,
  onCurrencyPress,
  categoryHint,
  metadata,
  descriptionInputAccessoryViewID,
  amountInputAccessoryViewID,
}: {
  icon: ReactNode;
  description: string;
  onDescriptionChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  onAmountBlur?: () => void;
  currency: string;
  onCurrencyPress: () => void;
  categoryHint: string;
  metadata?: ReactNode;
  descriptionInputAccessoryViewID?: string;
  amountInputAccessoryViewID?: string;
}) {
  const theme = useTheme();

  return (
    <View
      testID="expense-entry-card"
      style={{
        overflow: "hidden",
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 8px 28px rgba(0, 0, 0, 0.08)",
      }}
    >
      <View
        style={{
          minHeight: 94,
          paddingHorizontal: 18,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        {icon}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <TextInput
            accessibilityLabel="Description"
            value={description}
            onChangeText={onDescriptionChange}
            placeholder="What was this for?"
            placeholderTextColor={theme.subtle}
            selectionColor={theme.primary}
            clearButtonMode="while-editing"
            returnKeyType="next"
            inputAccessoryViewID={descriptionInputAccessoryViewID}
            style={{
              color: theme.text,
              minHeight: 36,
              padding: 0,
              fontSize: 23,
              lineHeight: 29,
              fontWeight: "700",
              letterSpacing: -0.4,
            }}
          />
          <Text
            numberOfLines={1}
            style={{ color: theme.muted, fontSize: 12, lineHeight: 16 }}
          >
            {categoryHint}
          </Text>
        </View>
      </View>

      <View
        style={{
          height: 1,
          marginLeft: 18,
          backgroundColor: theme.border,
        }}
      />

      <View style={{ paddingHorizontal: 18, paddingVertical: 16, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TextInput
            accessibilityLabel="Amount"
            value={amount}
            onChangeText={onAmountChange}
            onBlur={onAmountBlur}
            keyboardType="decimal-pad"
            inputAccessoryViewID={amountInputAccessoryViewID}
            placeholder="0.00"
            placeholderTextColor={theme.subtle}
            selectionColor={theme.primary}
            style={{
              color: theme.text,
              flex: 1,
              minWidth: 0,
              padding: 0,
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
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                {currency}
              </Text>
              <DropdownChevron color={theme.primary} />
            </View>
          </Pressable>
        </View>
        {metadata}
      </View>
    </View>
  );
}

export function AllocationChoiceCard({
  title,
  subtitle,
  accessibilityLabel,
  glyph,
  ready,
  enabled,
  onPress,
}: {
  title: string;
  subtitle?: string;
  accessibilityLabel?: string;
  glyph: string;
  ready: boolean;
  enabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const statusColor = !enabled
    ? theme.muted
    : ready
      ? theme.positive
      : theme.warning;
  const statusLabel = !enabled ? "Waiting" : ready ? "Ready" : "Review";
  const glyphBackground = !enabled
    ? theme.elevated
    : ready
      ? theme.positiveSurface
      : theme.elevated;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 144,
        padding: 14,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        justifyContent: "space-between",
        gap: 12,
        opacity: pressed ? 0.68 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            borderCurve: "continuous",
            backgroundColor: glyphBackground,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            accessibilityElementsHidden
            style={{
              color: enabled ? theme.primary : theme.muted,
              fontSize: 22,
              lineHeight: 25,
              fontWeight: "700",
            }}
          >
            {glyph}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: statusColor,
            }}
          />
          <Text
            style={{
              color: statusColor,
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      <View style={{ gap: 3 }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 17,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{ color: theme.muted, fontSize: 13, lineHeight: 17 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ComposerSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: 4, gap: 2 }}>
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "700",
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ExpenseSaveControl({
  label,
  onPress,
  disabled,
  backgroundColor,
  foregroundColor,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  backgroundColor?: ColorValue;
  foregroundColor?: ColorValue;
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
      <PrimaryButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        {...(backgroundColor ? { backgroundColor } : {})}
        {...(foregroundColor ? { foregroundColor } : {})}
      />
    </View>
  );
}
