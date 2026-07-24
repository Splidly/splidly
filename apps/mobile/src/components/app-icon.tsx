import { Image } from "expo-image";
import {
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const lightAppIcon = require("../../assets/icons/app-icon-light.png");
const darkAppIcon = require("../../assets/icons/app-icon-dark.png");

export function AppIcon({
  size,
  style,
}: {
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colorScheme = useColorScheme();
  const source = colorScheme === "dark" ? lightAppIcon : darkAppIcon;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Splidly app icon"
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          borderCurve: "continuous",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
    </View>
  );
}
