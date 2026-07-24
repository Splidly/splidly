import "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ApiProvider } from "../lib/trpc";
import { useTheme } from "../theme";

function Navigation() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider
      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="expense/new" options={{ title: "New Expense", presentation: "formSheet" }} />
        <Stack.Screen name="settlement/new" options={{ title: "Settle Up", presentation: "formSheet" }} />
        <Stack.Screen
          name="currency-picker"
          options={{
            title: "Currency",
            presentation: "formSheet",
            sheetAllowedDetents: [1],
            sheetGrabberVisible: false,
          }}
        />
        <Stack.Screen name="invite/[token]" options={{ title: "Invitation" }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ApiProvider>
        <Navigation />
      </ApiProvider>
    </GestureHandlerRootView>
  );
}
