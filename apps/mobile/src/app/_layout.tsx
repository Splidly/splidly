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
import {
  expenseDetailSheetOptions,
  formSheetOptions,
  nativeHeaderOptions,
} from "../lib/navigation";
import { ApiProvider } from "../lib/trpc";
import { OfflineNotice } from "../components/offline-notice";
import { useTheme } from "../theme";
import { ExpensePaymentSessionProvider } from "../components/expense-payment-session";
import { ExpenseItemSplitSessionProvider } from "../components/expense-item-split-session";
import { ExpenseSplitSessionProvider } from "../components/expense-split-session";
import { NotificationCoordinator } from "../components/notification-coordinator";

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
          ...nativeHeaderOptions(theme.background),
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            ...formSheetOptions(theme.sheet),
            sheetAllowedDetents: "fitToContents",
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: false,
            sheetCornerRadius: 30,
            gestureEnabled: false,
            headerBackButtonMenuEnabled: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="expense/new"
          options={{
            title: "New Expense",
            ...formSheetOptions(theme.background),
          }}
        />
        <Stack.Screen
          name="expense/[id]/index"
          options={{
            title: "Expense",
            ...expenseDetailSheetOptions(theme.sheet),
          }}
        />
        <Stack.Screen
          name="expense/[id]/edit"
          options={{
            title: "Edit Expense",
            ...formSheetOptions(theme.background),
          }}
        />
        <Stack.Screen
          name="expense/payment"
          options={{
            title: "Paid by",
            presentation: "fullScreenModal",
          }}
        />
        <Stack.Screen
          name="expense/split"
          options={{
            title: "Split expense",
            presentation: "fullScreenModal",
          }}
        />
        <Stack.Screen
          name="expense/item-split"
          options={{
            title: "Customize item",
            ...formSheetOptions(theme.sheet),
            sheetAllowedDetents: [0.72, 1],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="settlement/group"
          options={{
            title: "Settle Up",
            ...formSheetOptions(theme.sheet),
            sheetAllowedDetents: "fitToContents",
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: false,
            sheetCornerRadius: 30,
            headerBackButtonMenuEnabled: false,
          }}
        />
        <Stack.Screen
          name="settlement/new"
          options={{
            title: "Record Payment",
            ...formSheetOptions(theme.sheet),
            sheetAllowedDetents: [0.82, 1],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="currency-picker"
          options={
            process.env.EXPO_OS === "ios"
              ? {
                  title: "Currency",
                  ...formSheetOptions(theme.sheet),
                  sheetAllowedDetents: [1],
                  sheetGrabberVisible: false,
                }
              : {
                  title: "Currency",
                  presentation: "fullScreenModal",
                  contentStyle: { backgroundColor: theme.sheet },
                }
          }
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
        <NotificationCoordinator />
        <ExpensePaymentSessionProvider>
          <ExpenseSplitSessionProvider>
            <ExpenseItemSplitSessionProvider>
              <Navigation />
              <OfflineNotice />
            </ExpenseItemSplitSessionProvider>
          </ExpenseSplitSessionProvider>
        </ExpensePaymentSessionProvider>
      </ApiProvider>
    </GestureHandlerRootView>
  );
}
