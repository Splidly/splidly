import { Children, type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { Avatar, RowDivider } from "./ui";

export function AllocationHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: 30,
        paddingHorizontal: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Text
        style={{
          color: theme.muted,
          fontSize: 13,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
        >
          <Text
            style={{
              color: theme.primary,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SelectionControl({
  selected,
  label,
  name,
  colorKey,
  imageUrl,
  onValueChange,
}: {
  selected: boolean;
  label: string;
  name: string;
  colorKey: string;
  imageUrl?: string | null | undefined;
  onValueChange: (selected: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={8}
      onPress={() => onValueChange(!selected)}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        opacity: pressed ? 0.6 : selected ? 1 : 0.62,
      })}
    >
      <Avatar
        name={name}
        colorKey={colorKey}
        imageUrl={imageUrl}
        size={36}
      />
      <View
        style={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: theme.surface,
          backgroundColor: selected ? theme.primary : theme.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <Text
            accessibilityElementsHidden
            style={{
              color: theme.primaryText,
              fontSize: 11,
              fontWeight: "800",
              lineHeight: 12,
            }}
          >
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function InlineAmountInput({
  accessibilityLabel,
  value,
  onChangeText,
  suffix,
  placeholder = "0",
  keyboardType = "decimal-pad",
  width = 104,
}: {
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  suffix: string;
  placeholder?: string;
  keyboardType?: "decimal-pad" | "number-pad";
  width?: number;
}) {
  const theme = useTheme();
  const digitCount = value.replace(/\D/g, "").length;
  const fontSize = digitCount > 9 ? 13 : digitCount > 6 ? 14 : 15;
  return (
    <View
      style={{
        width,
        minHeight: 34,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 10,
        borderCurve: "continuous",
        backgroundColor: theme.elevated,
      }}
    >
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        returnKeyType="done"
        selectTextOnFocus
        numberOfLines={1}
        placeholder={placeholder}
        placeholderTextColor={theme.subtle}
        selectionColor={theme.primary}
        style={{
          flex: 1,
          minWidth: 24,
          padding: 0,
          color: theme.text,
          fontSize,
          textAlign: "right",
          fontVariant: ["tabular-nums"],
        }}
      />
      <Text
        style={{
          color: theme.muted,
          fontSize: 12,
          fontWeight: "600",
        }}
      >
        {suffix}
      </Text>
    </View>
  );
}

export function AllocationList({
  children,
}: {
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
      }}
    >
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <RowDivider inset={58} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

export function AllocationRow({
  userId,
  name,
  imageUrl,
  selected,
  onSelectedChange,
  amount,
  onAmountChange,
  amountLabel,
  suffix,
  displayValue,
  keyboardType,
  placeholder,
  selectionLabel,
}: {
  userId: string;
  name: string;
  imageUrl?: string | null | undefined;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  amount?: string;
  onAmountChange?: (value: string) => void;
  amountLabel?: string;
  suffix?: string;
  displayValue?: string;
  keyboardType?: "decimal-pad" | "number-pad";
  placeholder?: string;
  selectionLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: 56,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <SelectionControl
        selected={selected}
        name={name}
        colorKey={userId}
        imageUrl={imageUrl}
        label={
          selectionLabel ?? `${selected ? "Remove" : "Select"} ${name}`
        }
        onValueChange={onSelectedChange}
      />
      <Text
        numberOfLines={1}
        style={{
          color: selected ? theme.text : theme.muted,
          flex: 1,
          fontSize: 15,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {name}
      </Text>
      {selected && amount !== undefined && onAmountChange && suffix ? (
        <InlineAmountInput
          accessibilityLabel={amountLabel ?? `${name} amount`}
          value={amount}
          onChangeText={onAmountChange}
          suffix={suffix}
          width={suffix === "%" || suffix === "×" ? 88 : 104}
          {...(keyboardType ? { keyboardType } : {})}
          {...(placeholder ? { placeholder } : {})}
        />
      ) : selected && displayValue ? (
        <Text
          style={{
            color: theme.muted,
            fontSize: 14,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {displayValue}
        </Text>
      ) : null}
    </View>
  );
}
