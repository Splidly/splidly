import { useState } from "react";
import {
  Text,
  type ColorValue,
  type StyleProp,
  type TextStyle,
} from "react-native";
import type { GroupBalanceLine } from "../lib/group-balance-summary";
import { useTheme } from "../theme";

function toneColor(
  tone: GroupBalanceLine["tone"],
  theme: ReturnType<typeof useTheme>,
): ColorValue {
  if (tone === "positive") return theme.positive;
  if (tone === "negative") return theme.negative;
  return theme.muted;
}

export function BalanceSummaryLine({
  line,
  style,
  numberOfLines,
}: {
  line: GroupBalanceLine;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const hasTintedAmount = Boolean(line.amount);
  const [usesInitials, setUsesInitials] = useState(false);
  const label =
    usesInitials && line.compactLabel ? line.compactLabel : line.label;

  return (
    <Text
      accessibilityLabel={line.text}
      numberOfLines={numberOfLines}
      onTextLayout={
        line.compactLabel && !usesInitials
          ? (event) => {
              if (event.nativeEvent.lines.length > 1) {
                setUsesInitials(true);
              }
            }
          : undefined
      }
      style={[
        style,
        {
          color: hasTintedAmount
            ? theme.muted
            : toneColor(line.tone, theme),
        },
      ]}
    >
      {label}
      {hasTintedAmount ? (
        <Text
          style={{
            color: toneColor(line.tone, theme),
            fontWeight: "600",
          }}
        >
          {" "}
          {line.amount}
        </Text>
      ) : null}
    </Text>
  );
}
