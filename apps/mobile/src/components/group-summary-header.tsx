import type { GroupIconKey } from "@splidly/shared";
import { Button, Host } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";
import type { GroupBalanceLine } from "../lib/group-balance-summary";
import { useTheme } from "../theme";
import { BalanceSummaryLine } from "./balance-summary-line";
import { GroupIcon } from "./group-icon";

type GroupSummaryLine = GroupBalanceLine;

export function GroupBalanceSummary({
  lines,
}: {
  lines: readonly GroupSummaryLine[];
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
});
