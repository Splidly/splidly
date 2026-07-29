import type { ColorValue } from "react-native";

export function formSheetOptions(backgroundColor: ColorValue) {
  return {
    presentation: "formSheet",
    headerStyle: { backgroundColor },
    contentStyle: { backgroundColor },
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
