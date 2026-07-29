import { Stack } from "expo-router";
import { inlineLargeTitleOptions } from "../../../lib/navigation";
import { useTheme } from "../../../theme";

export default function ProfileStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
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
    </Stack>
  );
}
