import type { CurrencyCode, GroupIconKey } from "@splidly/shared";
import { Button, Host } from "@expo/ui";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GroupBalanceLine } from "../lib/group-balance-summary";
import { formatConvertedMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { BalanceSummaryLine } from "./balance-summary-line";
import { GroupIcon } from "./group-icon";

type GroupSummaryLine = GroupBalanceLine;

export function GroupBalanceSummary({
  lines,
  currency,
  totalMinor,
}: {
  lines: readonly GroupSummaryLine[];
  currency?: CurrencyCode;
  totalMinor?: bigint;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (lines.length > 3 && currency && totalMinor !== undefined) {
    const total = formatConvertedMoney(totalMinor, currency);
    return (
      <View style={styles.accordion}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Outstanding ${total}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [
            styles.accordionButton,
            { opacity: pressed ? 0.62 : 1 },
          ]}
        >
          <Text
            style={[styles.accordionTitle, { color: theme.text }]}
          >
            Outstanding · {total}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 20 }}>
            {expanded ? "⌃" : "⌄"}
          </Text>
        </Pressable>
        {expanded ? (
          <View style={styles.accordionLines}>
            {lines.map((line) => (
              <BalanceSummaryLine
                key={line.key}
                line={line}
                style={styles.summaryLine}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }
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

export function GroupSummaryHeader({
  iconKey,
  name,
  colorKey,
  color,
  imageUrl,
  lines,
  onEdit,
}: {
  iconKey: GroupIconKey;
  name: string;
  colorKey: string;
  color?: string | null | undefined;
  imageUrl?: string | null | undefined;
  lines?: readonly GroupSummaryLine[];
  onEdit?: (() => void) | undefined;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <GroupIcon
        iconKey={iconKey}
        name={name}
        colorKey={colorKey}
        color={color}
        imageUrl={imageUrl}
        size={52}
      />
      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: theme.text }]}
        >
          {name}
        </Text>
        {(lines ?? []).map((line) => (
          <BalanceSummaryLine
            key={line.key}
            line={line}
            style={styles.subtitle}
          />
        ))}
      </View>
      {onEdit ? (
        <Host
          matchContents
          seedColor={color ?? theme.primary}
        >
          <Button
            label="Edit"
            variant="outlined"
            testID="edit-group"
            onPress={onEdit}
          />
        </Host>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 2,
  },
  copy: {
    flex: 1,
    gap: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ["tabular-nums"],
  },
  summary: {
    paddingHorizontal: 4,
    gap: 4,
  },
  summaryLine: {
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  accordion: {
    borderRadius: 14,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  accordionButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  accordionTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  accordionLines: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 4,
  },
});
