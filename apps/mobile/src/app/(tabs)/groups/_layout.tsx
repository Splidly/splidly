import { Stack } from "expo-router";
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
        headerLargeTitleShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="new"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.62],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: false,
          sheetCornerRadius: 30,
          gestureEnabled: false,
          headerBackButtonMenuEnabled: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      <Stack.Screen name="[id]/index" options={{ title: "Group" }} />
      <Stack.Screen name="[id]/settings" options={{ title: "Group Settings" }} />
    </Stack>
  );
}
