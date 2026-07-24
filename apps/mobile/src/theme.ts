import { useColorScheme, type ColorValue } from "react-native";

type Palette = {
  background: ColorValue;
  surface: ColorValue;
  elevated: ColorValue;
  text: ColorValue;
  muted: ColorValue;
  subtle: ColorValue;
  border: ColorValue;
  primary: ColorValue;
  primaryPressed: ColorValue;
  primaryText: ColorValue;
  positive: ColorValue;
  positiveSurface: ColorValue;
  negative: ColorValue;
  negativeSurface: ColorValue;
  warning: ColorValue;
};

const light: Palette = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  elevated: "#E9E9F2",
  text: "#17171C",
  muted: "#6E6E78",
  subtle: "#AEAEB8",
  border: "#D8D8DE",
  primary: "#5856D6",
  primaryPressed: "#4745B8",
  primaryText: "#FFFFFF",
  positive: "#16845B",
  positiveSurface: "#E2F4EC",
  negative: "#D33A3A",
  negativeSurface: "#FCE8E7",
  warning: "#A85D00",
};

const dark: Palette = {
  background: "#000000",
  surface: "#1C1C1E",
  elevated: "#2C2C2E",
  text: "#F5F5F7",
  muted: "#A1A1AA",
  subtle: "#6C6C70",
  border: "#38383A",
  primary: "#7D7AFF",
  primaryPressed: "#6966E8",
  primaryText: "#FFFFFF",
  positive: "#55D6A0",
  positiveSurface: "#17372C",
  negative: "#FF6961",
  negativeSurface: "#3B2020",
  warning: "#FFB454",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}
