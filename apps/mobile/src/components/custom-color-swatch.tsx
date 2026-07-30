import { Pressable, StyleSheet, View } from "react-native";

export function CustomColorSwatch({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Custom group color"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.touchTarget,
        selected ? styles.selected : null,
        { opacity: pressed ? 0.68 : 1 },
      ]}
    >
      <View style={styles.wheel}>
        <View style={[styles.quadrant, { backgroundColor: "#FF3B30" }]} />
        <View style={[styles.quadrant, { backgroundColor: "#FFCC00" }]} />
        <View style={[styles.quadrant, { backgroundColor: "#34C759" }]} />
        <View style={[styles.quadrant, { backgroundColor: "#0A84FF" }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    borderColor: "#0A84FF",
  },
  wheel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.18)",
  },
  quadrant: {
    width: 16,
    height: 16,
  },
});
