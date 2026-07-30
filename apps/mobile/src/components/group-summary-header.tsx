import type { GroupIconKey } from "@splidly/shared";
import { Button, Host } from "@expo/ui";
import {
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import { useTheme } from "../theme";
import { GroupIcon } from "./group-icon";

type GroupSummaryLine = {
  key: string;
  text: string;
  tone?: "positive" | "negative" | "muted";
};

export function GroupSummaryHeader({
  iconKey,
  name,
  colorKey,
  color,
  lines,
  onEdit,
}: {
  iconKey: GroupIconKey;
  name: string;
  colorKey: string;
  color?: string | null | undefined;
  lines: readonly GroupSummaryLine[];
  onEdit?: (() => void) | undefined;
}) {
  const theme = useTheme();

  function lineColor(tone: GroupSummaryLine["tone"]): ColorValue {
    if (tone === "positive") return theme.positive;
    if (tone === "negative") return theme.negative;
    return theme.muted;
  }

  return (
    <View style={styles.row}>
      <GroupIcon
        iconKey={iconKey}
        name={name}
        colorKey={colorKey}
        color={color}
        size={58}
      />
      <View style={styles.copy}>
        <Text
          selectable
          numberOfLines={1}
          style={[styles.name, { color: theme.text }]}
        >
          {name}
        </Text>
        {lines.map((line) => (
          <Text
            key={line.key}
            selectable
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color: lineColor(line.tone),
                fontWeight: line.tone === "muted" ? "400" : "500",
              },
            ]}
          >
            {line.text}
          </Text>
        ))}
      </View>
      {onEdit ? (
        <Host
          matchContents
          seedColor={theme.primary}
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
    gap: 3,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
