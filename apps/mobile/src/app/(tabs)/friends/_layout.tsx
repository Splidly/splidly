import { Stack } from "expo-router";
import {
  inlineLargeTitleOptions,
  nativeHeaderOptions,
} from "../../../lib/navigation";
import { useTheme } from "../../../theme";

export default function FriendsStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        ...nativeHeaderOptions(theme.background),
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Friends",
          ...inlineLargeTitleOptions(theme.text),
        }}
      />
      <Stack.Screen name="[id]" options={{ title: "" }} />
    </Stack>
  );
}
