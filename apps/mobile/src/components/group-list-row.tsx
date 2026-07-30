import {
  formatMinor,
  type CurrencyCode,
  type GroupIconKey,
  type Money,
} from "@splidly/shared";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import {
  groupListBalanceLines,
  type GroupMemberBalance,
  type GroupListSummaryLine,
} from "../lib/group-balance-summary";
import { useTheme } from "../theme";
import { GroupIcon } from "./group-icon";

function toneColor(
  tone: "positive" | "negative" | "muted",
  theme: ReturnType<typeof useTheme>,
): ColorValue {
  if (tone === "positive") return theme.positive;
  if (tone === "negative") return theme.negative;
  return theme.muted;
}

export function GroupListSummary({
  lines,
}: {
  lines: readonly GroupListSummaryLine[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.summary}>
      {lines.map((line) => (
        <Text
          key={line.key}
          selectable
          style={[
            styles.summaryText,
            { color: toneColor(line.tone, theme) },
          ]}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

export function GroupListRow({
  id,
  name,
  iconKey,
  color,
  balance,
  memberBalances,
  onPress,
}: {
  id: string;
  name: string;
  iconKey: GroupIconKey;
  color?: string | null | undefined;
  balance: Money;
  memberBalances: GroupMemberBalance[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const lines = groupListBalanceLines(memberBalances);
  const minor = BigInt(balance.minor);
  const absoluteMinor = minor < 0n ? -minor : minor;
  const hasOpenPayments = memberBalances.length > 0;
  const tone =
    minor > 0n ? "positive" : minor < 0n ? "negative" : "muted";
  const status =
    minor > 0n
      ? "You are owed"
      : minor < 0n
        ? "You owe"
        : hasOpenPayments
          ? "Net balance"
          : "Settled up";
  const amount = `${formatMinor(
    absoluteMinor,
    balance.currency as CurrencyCode,
  )} ${balance.currency}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status}${
        !hasOpenPayments && minor === 0n ? "" : ` ${amount}`
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.elevated : "transparent",
        },
      ]}
    >
      <GroupIcon
        iconKey={iconKey}
        name={name}
        colorKey={id}
        color={color}
        size={60}
      />
      <View style={styles.copy}>
        <Text
          selectable
          numberOfLines={1}
          style={[styles.name, { color: theme.text }]}
        >
          {name}
        </Text>
        <View style={styles.subtitles}>
          {lines.map((line) => (
            <Text
              key={line.key}
              selectable
              numberOfLines={2}
              style={[
                styles.subtitle,
                { color: toneColor(line.tone, theme) },
              ]}
            >
              {line.text}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.trailing}>
        <Text
          numberOfLines={1}
          style={[
            styles.status,
            { color: toneColor(tone, theme) },
          ]}
        >
          {status}
        </Text>
        {hasOpenPayments || minor !== 0n ? (
          <Text
            selectable
            numberOfLines={1}
            style={[
              styles.amount,
              { color: toneColor(tone, theme) },
            ]}
          >
            {amount}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 28,
    paddingHorizontal: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 3,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  row: {
    minHeight: 100,
    paddingHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 14,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitles: {
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  trailing: {
    maxWidth: "32%",
    alignItems: "flex-end",
    gap: 2,
  },
  status: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  amount: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
