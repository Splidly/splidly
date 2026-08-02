import { Host, Icon } from "@expo/ui";
import { View, type ColorValue } from "react-native";

const chevron = Icon.select({
  ios: "chevron.down",
  android: import("@expo/material-symbols/keyboard_arrow_down.xml"),
});

export function DropdownChevron({
  color,
  size = 13,
}: {
  color: ColorValue;
  size?: number;
}) {
  return (
    <View
      testID="currency-chevron"
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
        <Icon name={chevron} size={size} color={color} />
      </Host>
    </View>
  );
}
