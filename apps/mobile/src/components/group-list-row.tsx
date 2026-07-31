import {
  type CurrencyCode,
  type GroupIconKey,
  type Money,
} from "@splidly/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  groupListBalanceLines,
  type GroupMemberBalance,
  type GroupListSummaryLine,
} from "../lib/group-balance-summary";
import { formatConvertedMoney } from "../lib/money-display";
import { spacing, useTheme } from "../theme";
import { BalanceSummaryLine } from "./balance-summary-line";
import { GroupIcon } from "./group-icon";

export function GroupListSummary({
  lines,
}: {
  lines: readonly GroupListSummaryLine[];
}) {
  return (
    <View style={styles.summary}>
      {lines.map((line) => (
        <BalanceSummaryLine
          key={line.key}
          line={line}
          style={styles.summaryLine}
        />
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
  const [trailingWidth, setTrailingWidth] = useState(96);
  const lines = groupListBalanceLines(memberBalances);
  const minor = BigInt(balance.minor);
  const absoluteMinor = minor < 0n ? -minor : minor;
  const hasOpenPayments = memberBalances.length > 0;
  const isSettled = !hasOpenPayments && minor === 0n;
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
  const amount = formatConvertedMoney(
    absoluteMinor,
    balance.currency as CurrencyCode,
  );
  const trailing = (
    <View
      onLayout={
        isSettled
          ? undefined
          : (event) => setTrailingWidth(event.nativeEvent.layout.width)
      }
      style={[
        styles.trailing,
        isSettled ? null : styles.trailingOverlay,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.status,
          {
            color:
              tone === "positive"
                ? theme.positive
                : tone === "negative"
                  ? theme.negative
                  : theme.muted,
          },
        ]}
      >
        {status}
      </Text>
      {hasOpenPayments || minor !== 0n ? (
        <Text
          numberOfLines={1}
          style={[
            styles.amount,
            {
              color:
                tone === "positive"
                  ? theme.positive
                  : tone === "negative"
                    ? theme.negative
                    : theme.muted,
            },
          ]}
        >
          {amount}
        </Text>
      ) : null}
    </View>
  );

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
        size={52}
      />
      <View style={[styles.copy, isSettled ? styles.copyCentered : null]}>
        <View
          style={[styles.heading, isSettled ? styles.headingCentered : null]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: theme.text },
              isSettled ? null : { paddingRight: trailingWidth + 8 },
            ]}
          >
            {name}
          </Text>
          {isSettled ? trailing : null}
        </View>
        {isSettled ? null : trailing}
        <View style={styles.subtitles}>
          {lines.map((line, index) => (
            <BalanceSummaryLine
              key={line.key}
              line={line}
              style={[
                styles.subtitle,
                index === 0 ? { paddingRight: trailingWidth + 8 } : null,
              ]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 28,
    paddingHorizontal: 4,
    gap: 4,
  },
  summaryLine: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  row: {
    minHeight: 76,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md + spacing.xs,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    position: "relative",
  },
  copyCentered: {
    justifyContent: "center",
    gap: 0,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headingCentered: {
    minHeight: 52,
    alignItems: "center",
  },
  name: {
    flex: 1,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitles: {
    gap: 3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ["tabular-nums"],
  },
  trailing: {
    maxWidth: "40%",
    alignItems: "flex-end",
    gap: 2,
  },
  trailingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  status: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
