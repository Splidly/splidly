import { Stack } from "expo-router";
import {
  formSheetOptions,
  inlineLargeTitleOptions,
  nativeHeaderOptions,
} from "../../../lib/navigation";
import { useTheme } from "../../../theme";

export default function ProfileStackLayout() {
  const theme = useTheme();
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
          title: "Profile",
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
