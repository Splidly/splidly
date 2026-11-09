import {
  type CurrencyCode,
  type GroupIconKey,
  type Money,
} from "@splidly/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
  imageUrl,
  balance,
  memberBalances,
  onPress,
  contained = false,
}: {
  id: string;
  name: string;
  iconKey: GroupIconKey;
  color?: string | null | undefined;
  imageUrl?: string | null | undefined;
  balance: Money;
  memberBalances: GroupMemberBalance[];
  onPress: () => void;
  contained?: boolean;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(width);
  const [trailingWidth, setTrailingWidth] = useState(96);
  const copyWidth = rowWidth - 2 * (spacing.md + spacing.xs) - 52 - 12;
  const stacked = fontScale > 1.2 || copyWidth - trailingWidth - 8 < 120;
  const lines = groupListBalanceLines(memberBalances);
  const visibleLines = lines.length > 3 ? lines.slice(0, 2) : lines;
  const hiddenLineCount = lines.length - visibleLines.length;
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
      testID={`group-total-${id}`}
      onLayout={
        isSettled || stacked
          ? undefined
          : (event) => setTrailingWidth(event.nativeEvent.layout.width)
      }
      style={[
        styles.trailing,
        stacked ? styles.trailingStacked : null,
        isSettled || stacked ? null : styles.trailingOverlay,
      ]}
    >
      <Text
        selectable={false}
        numberOfLines={stacked ? undefined : 1}
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
        selectable={false}
          numberOfLines={stacked ? undefined : 1}
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
      testID={`activity-group-${id}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status}${
        !hasOpenPayments && minor === 0n ? "" : ` ${amount}`
      }`}
      onPress={onPress}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.row,
        contained ? { marginHorizontal: 0 } : null,
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
        imageUrl={imageUrl}
        size={52}
      />
      <View style={[styles.copy, isSettled && !stacked ? styles.copyCentered : null]}>
        <View
          style={[styles.heading, isSettled && !stacked ? styles.headingCentered : null]}
        >
          <Text
        selectable={false}
            numberOfLines={stacked ? undefined : 2}
            style={[
              styles.name,
              { color: theme.text },
              isSettled || stacked ? null : { paddingRight: trailingWidth + 8 },
            ]}
          >
            {name}
          </Text>
          {isSettled && !stacked ? trailing : null}
        </View>
        {stacked || !isSettled ? trailing : null}
        <View style={styles.subtitles}>
          {visibleLines.map((line, index) => (
            <BalanceSummaryLine
              key={line.key}
              line={line}
              style={[
                styles.subtitle,
                !stacked && index === 0 ? { paddingRight: trailingWidth + 8 } : null,
              ]}
            />
          ))}
          {hiddenLineCount > 0 ? (
            <Text selectable={false} style={[styles.subtitle, { color: theme.muted }]}>
              {hiddenLineCount} more not shown
            </Text>
          ) : null}
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
    minWidth: 0,
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
  trailingStacked: {
    maxWidth: "100%",
    alignSelf: "stretch",
    alignItems: "flex-start",
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
