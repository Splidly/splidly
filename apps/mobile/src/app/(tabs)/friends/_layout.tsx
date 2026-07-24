import { Stack } from "expo-router";
import { useTheme } from "../../../theme";

export default function FriendsStackLayout() {
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
      <Stack.Screen name="[id]" options={{ title: "" }} />
    </Stack>
  );
}
