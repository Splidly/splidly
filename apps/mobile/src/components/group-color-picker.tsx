import {
  groupColorPresets,
  type GroupColor,
} from "@splidly/shared";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { spacing, useTheme } from "../theme";
import { CustomGroupColorPicker } from "./custom-group-color-picker";

export function GroupColorPicker({
  value,
  onValueChange,
}: {
  value: GroupColor;
  onValueChange: (value: GroupColor) => void;
}) {
  const theme = useTheme();
  const [openingValue] = useState(value);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const isCustom = !(groupColorPresets as readonly string[]).includes(value);
  const openingValueIsPreset = (
    groupColorPresets as readonly string[]
  ).includes(openingValue);
  const orderedPresets = openingValueIsPreset
    ? [
        openingValue,
        ...groupColorPresets.filter((color) => color !== openingValue),
      ]
    : groupColorPresets;
  const canScrollForward =
    contentWidth - viewportWidth - scrollOffset > 4;
  const sheetColor = String(theme.sheet);
  const customPicker = (
    <CustomGroupColorPicker
      value={value}
      selected={isCustom}
      onValueChange={onValueChange}
    />
  );

  return (
    <View style={styles.section} testID="group-color-picker">
      <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
      <View
        testID="group-color-palette"
        onLayout={(event) =>
          setViewportWidth(event.nativeEvent.layout.width)
        }
        style={styles.palette}
      >
        <ScrollView
          horizontal
          bounces
          testID="group-color-scroll"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.colors}
          onContentSizeChange={(width) => setContentWidth(width)}
          onScroll={(event) =>
            setScrollOffset(event.nativeEvent.contentOffset.x)
          }
        >
          {openingValueIsPreset ? null : customPicker}
          {orderedPresets.map((color) => {
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
          {openingValueIsPreset ? customPicker : null}
        </ScrollView>
        {canScrollForward ? (
          <View
            pointerEvents="none"
            testID="group-color-overflow"
            style={[
              styles.overflowFade,
              {
                experimental_backgroundImage: `linear-gradient(to right, ${sheetColor}00 0%, ${sheetColor} 88%)`,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colors: {
    gap: 6,
  },
  palette: {
    position: "relative",
  },
  overflowFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 26,
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
