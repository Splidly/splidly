import {
  groupColorPresets,
  type GroupColor,
} from "@splidly/shared";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { CustomGroupColorPicker } from "./custom-group-color-picker";

export function GroupColorPicker({
  value,
  onValueChange,
}: {
  value: GroupColor;
  onValueChange: (value: GroupColor) => void;
}) {
  const theme = useTheme();
  const isCustom = !(groupColorPresets as readonly string[]).includes(value);

  return (
    <View style={styles.section} testID="group-color-picker">
      <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
      <ScrollView
        horizontal
        bounces
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colors}
      >
        {groupColorPresets.map((color) => {
          const selected = color === value;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Group color ${color}`}
              accessibilityState={{ selected }}
              onPress={() => onValueChange(color)}
              style={({ pressed }) => [
                styles.touchTarget,
                selected
                  ? { borderColor: theme.text }
                  : styles.unselected,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: color,
                    borderColor: theme.border,
                  },
                ]}
              />
            </Pressable>
          );
        })}
        <CustomGroupColorPicker
          value={value}
          selected={isCustom}
          onValueChange={onValueChange}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  label: {
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colors: {
    gap: 6,
    paddingHorizontal: 2,
  },
  touchTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  unselected: {
    borderColor: "transparent",
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
