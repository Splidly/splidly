import { Stack } from "expo-router";
import { Platform } from "react-native";
import {
  formSheetOptions,
  inlineLargeTitleOptions,
  nativeHeaderOptions,
} from "../../../lib/navigation";
import { useTheme } from "../../../theme";

export default function ProfileStackLayout() {
  const theme = useTheme();
  const tablet = process.env.EXPO_OS === "ios" && "isPad" in Platform && Platform.isPad;
  return (
    <Stack
      screenOptions={{
        ...nativeHeaderOptions(theme.background),
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: tablet ? "" : "Profile",
          ...inlineLargeTitleOptions(theme.text),
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: "Notifications",
          ...formSheetOptions(theme.sheet),
          sheetAllowedDetents: "fitToContents",
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
