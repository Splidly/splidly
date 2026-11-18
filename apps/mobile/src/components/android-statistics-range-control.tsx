import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export function AndroidStatisticsRangeControl({
  labels,
  selectedIndex,
  onSelect,
}: {
  labels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();

  return (
    <View
      testID="statistics-range-control"
      accessibilityRole="tablist"
      accessibilityLabel="Statistics period"
      style={[styles.track, { backgroundColor: theme.elevated }]}
    >
      {labels.map((label, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => { if (!selected) onSelect(index); }}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: selected ? theme.surface : "transparent", opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              selectable={false}
              style={[styles.label, { color: selected ? theme.text : theme.muted, fontWeight: selected ? "600" : "400" }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: 16, gap: 2 },
  segment: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
