import { Host, Icon } from "@expo/ui";
import { View, type ColorValue } from "react-native";

const downChevron = Icon.select({
  ios: "chevron.down",
  android: import("@expo/material-symbols/keyboard_arrow_down.xml"),
});
const upChevron = Icon.select({
  ios: "chevron.up",
  android: import("@expo/material-symbols/keyboard_arrow_up.xml"),
});

export function DropdownChevron({
  color,
  direction = "down",
  size = 13,
  testID = "currency-chevron",
}: {
  color: ColorValue;
  direction?: "down" | "up";
  size?: number;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Host
        matchContents
        ignoreSafeArea="all"
        style={{ width: size, height: size }}
      >
        <Icon
          name={direction === "up" ? upChevron : downChevron}
          size={size}
          color={color}
        />
      </Host>
    </View>
  );
}
