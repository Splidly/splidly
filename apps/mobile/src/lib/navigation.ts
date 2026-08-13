import type { NativeStackNavigationOptions } from "expo-router";
import type { ColorValue } from "react-native";

type NativeHeaderOptions = Pick<
  NativeStackNavigationOptions,
  "headerStyle" | "headerTransparent"
>;

export function nativeHeaderOptions(
  backgroundColor: ColorValue,
): NativeHeaderOptions {
  if (process.env.EXPO_OS !== "ios") {
    return {
      headerStyle: { backgroundColor },
    };
  }

  return {
    // This is the Expo Router Notes/Mail pattern. UIKit owns the automatic
    // scroll-edge treatment while the first-child ScrollView underlaps the bar.
    headerTransparent: true,
  };
}

export function formSheetOptions(backgroundColor: ColorValue) {
  return {
    presentation: "formSheet",
    headerTransparent: false,
    headerStyle: { backgroundColor },
    contentStyle: { backgroundColor },
  } as const;
}

export function expenseDetailSheetOptions(backgroundColor: ColorValue) {
  return {
    ...formSheetOptions(backgroundColor),
    sheetAllowedDetents: [0.65, 1] as number[],
    sheetInitialDetentIndex: 0,
    // Keep content scrolling independent from dragging the compact sheet.
    sheetExpandsWhenScrolledToEdge: false,
    sheetGrabberVisible: true,
  } as const;
}

export function inlineLargeTitleOptions(color: ColorValue) {
  if (process.env.EXPO_OS !== "ios") return {};

  return {
    headerLargeTitleEnabled: false,
    headerStyle: { backgroundColor: "transparent" },
    unstable_nativeProps: {
      headerConfig: {
        // The react-native-screens patch maps this explicit large-title style
        // to UIKit's inline-large mode without enabling collapsible headers.
        largeTitleFontSize: 26,
        largeTitleFontWeight: "700",
        largeTitleColor: color,
      },
    },
  } as const;
}
