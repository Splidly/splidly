import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Keyboard } from "react-native";
import { useTheme } from "../theme";
import { useNavigationPressGuard } from "../lib/use-navigation-press-guard";
import { HeaderButton } from "./ui";

type AndroidFormHeaderProps = {
  title: string;
  closeLabel?: string;
  onClose?: () => void;
  disabled?: boolean;
  action?: {
    label: string;
    accessibilityLabel?: string;
    onPress: () => void;
    disabled?: boolean;
  };
};

/** Native navigation owns insets; form content stays in the shared Screen. */
export function AndroidFormHeader(props: AndroidFormHeaderProps) {
  if (process.env.EXPO_OS !== "android") return null;
  return <AndroidFormHeaderContent {...props} />;
}

function AndroidFormHeaderContent({
  title,
  closeLabel = "Close form",
  onClose = () => router.back(),
  disabled = false,
  action,
}: AndroidFormHeaderProps) {
  const theme = useTheme();
  const acceptNavigation = useNavigationPressGuard();
  useFocusEffect(
    useCallback(() => {
      if (process.env.EXPO_OS !== "android") return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!Keyboard.isVisible()) return false;
        Keyboard.dismiss();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackVisible: false,
        headerTransparent: false,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitleStyle: { fontSize: 20, fontWeight: "600" },
        headerStyle: { backgroundColor: theme.background },
        contentStyle: { backgroundColor: theme.background },
        headerLeft: () => (
          <HeaderButton
            label={closeLabel}
            glyph="×"
            disabled={disabled}
            onPress={() => {
              if (acceptNavigation()) onClose();
            }}
          />
        ),
        headerRight: action
          ? () => (
              <HeaderButton
                label={action.accessibilityLabel ?? action.label}
                glyph={action.label}
                disabled={action.disabled ?? false}
                onPress={() => {
                  if (acceptNavigation()) action.onPress();
                }}
              />
            )
          : () => null,
      }}
    />
  );
}
