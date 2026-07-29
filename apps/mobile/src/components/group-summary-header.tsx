import type { GroupIconKey } from "@splidly/shared";
import { Host, Icon } from "@expo/ui";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import { useTheme } from "../theme";
import { GroupIcon } from "./group-icon";

const EDIT_ICON = Icon.select({
  ios: "pencil",
  android: import("@expo/material-symbols/edit.xml"),
});

type GroupSummaryLine = {
  key: string;
  text: string;
  tone?: "positive" | "negative" | "muted";
};

export function GroupSummaryHeader({
  iconKey,
  name,
  colorKey,
  lines,
  onEdit,
}: {
  iconKey: GroupIconKey;
  name: string;
  colorKey: string;
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
          hitSlop={8}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,
            {
              backgroundColor: theme.elevated,
              borderColor: theme.border,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Host
            matchContents
            ignoreSafeArea="all"
            style={styles.editIcon}
          >
            <Icon
              name={EDIT_ICON}
              size={22}
              color={theme.primary}
              accessibilityLabel="Edit"
            />
          </Host>
        </Pressable>
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
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  editIcon: {
    width: 22,
    height: 22,
  },
});
