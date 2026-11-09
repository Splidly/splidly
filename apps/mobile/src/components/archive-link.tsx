import { Host, Icon } from "@expo/ui";
import { Pressable, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";
import type { ArchiveLinkProps } from "./archive-link.types";

const archiveIcon = Icon.select({
  ios: "archivebox",
  android: import("@expo/material-symbols/archive.xml"),
});
const settledIcon = Icon.select({
  ios: "checkmark.circle",
  android: import("@expo/material-symbols/check_circle.xml"),
});
const chevronIcon = Icon.select({
  ios: "chevron.right",
  android: import("@expo/material-symbols/chevron_right.xml"),
});

export function ArchiveLink({
  label,
  count,
  onPress,
  icon = "archive",
}: ArchiveLinkProps) {
  const theme = useTheme();
  const textStyle = {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        gap: spacing.sm,
        alignItems: "center",
        marginTop: spacing.sm,
        marginHorizontal: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        backgroundColor: pressed ? theme.elevated : "transparent",
      })}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 24, height: 24 }}
      >
        <Host matchContents ignoreSafeArea="all" style={{ width: 24, height: 24 }}>
          <Icon name={icon === "settled" ? settledIcon : archiveIcon} size={20} color={theme.muted} />
        </Host>
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "baseline",
          gap: spacing.sm,
        }}
      >
        <Text
          selectable={false}
          style={[textStyle, { flex: 1 }]}
        >
          {label}
        </Text>
        {count !== undefined ? (
          <Text
            selectable={false}
            style={[textStyle, { fontVariant: ["tabular-nums"] }]}
          >
            {count}
          </Text>
        ) : null}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 12, height: 16 }}
      >
        <Host matchContents ignoreSafeArea="all" style={{ width: 12, height: 16 }}>
          <Icon name={chevronIcon} size={12} color={theme.subtle} />
        </Host>
      </View>
    </Pressable>
  );
}
