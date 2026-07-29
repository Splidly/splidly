import { Stack } from "expo-router";
import {
  formSheetOptions,
  inlineLargeTitleOptions,
} from "../../../lib/navigation";
import { useTheme } from "../../../theme";

export default function GroupsStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Groups",
          ...inlineLargeTitleOptions(theme.text),
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          headerShown: false,
          ...formSheetOptions(theme.sheet),
          sheetAllowedDetents: [0.62],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: false,
          sheetCornerRadius: 30,
          gestureEnabled: false,
          headerBackButtonMenuEnabled: false,
        }}
      />
      <Stack.Screen name="[id]/index" options={{ title: "Group" }} />
      <Stack.Screen name="[id]/settings" options={{ title: "Group Settings" }} />
    </Stack>
  );
}
