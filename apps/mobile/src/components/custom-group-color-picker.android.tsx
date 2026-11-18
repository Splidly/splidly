import { groupColorSchema } from "@splidly/shared";
import { Host } from "@expo/ui/jetpack-compose";
import { requireNativeView } from "expo";
import { useRef, useState } from "react";
import { StyleSheet, useColorScheme, type NativeSyntheticEvent } from "react-native";
import { useTheme } from "../theme";
import { CustomColorSwatch } from "./custom-color-swatch";
import type { CustomGroupColorPickerProps } from "./custom-group-color-picker.types";

const ColorPickerView = requireNativeView<{
  color: string;
  onConfirm: (event: NativeSyntheticEvent<{ color: string }>) => void;
  onDismiss: () => void;
}>("SplidlyColorPicker", "ColorPickerView");

export function CustomGroupColorPicker({ value, selected, onValueChange }: CustomGroupColorPickerProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const [open, setOpen] = useState(false);
  const finished = useRef(false);

  const dismiss = () => {
    finished.current = true;
    setOpen(false);
  };

  return (
    <>
      <CustomColorSwatch selected={selected} onPress={() => {
        if (open) return;
        finished.current = false;
        setOpen(true);
      }} />
      {open ? (
        <Host
          style={styles.dialogHost}
          colorScheme={colorScheme}
          seedColor={theme.primary}
          colorOverrides={{
            surface: theme.sheet as `#${string}`,
            onSurface: theme.text as `#${string}`,
            onSurfaceVariant: theme.muted as `#${string}`,
            primary: theme.primary as `#${string}`,
            onPrimary: theme.primaryText as `#${string}`,
          }}
        >
          <ColorPickerView
            color={value}
            onDismiss={dismiss}
            onConfirm={({ nativeEvent }) => {
              if (finished.current) return;
              const color = groupColorSchema.safeParse(nativeEvent.color);
              if (!color.success) return;
              finished.current = true;
              onValueChange(color.data);
              setOpen(false);
            }}
          />
        </Host>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  dialogHost: { width: 1, height: 1 },
});
