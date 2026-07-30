import { ColorPicker, Host } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  frame,
  labelsHidden,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { normalizeGroupColor } from "../lib/group-colors";
import type { CustomGroupColorPickerProps } from "./custom-group-color-picker.types";

export function CustomGroupColorPicker({
  value,
  selected,
  onValueChange,
}: CustomGroupColorPickerProps) {
  return (
    <View style={[styles.container, selected ? styles.selected : null]}>
      <Host matchContents style={styles.host}>
        <ColorPicker
          selection={value}
          supportsOpacity={false}
          onSelectionChange={(nextValue) =>
            onValueChange(normalizeGroupColor(nextValue.slice(0, 7), value))
          }
          modifiers={[
            labelsHidden(),
            frame({ width: 36, height: 36 }),
            accessibilityLabel("Custom group color"),
          ]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  host: {
    width: 36,
    height: 36,
  },
});
