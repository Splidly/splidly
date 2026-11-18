import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

type Props = {
  provider: "google" | "apple";
  disabled: boolean;
  onPress: () => void;
};

// Official provider artwork: Google Identity branding assets and Apple Design Resources.
export function AndroidSignInButton({ provider, disabled, onPress }: Props) {
  const theme = useTheme();
  const dark = theme.background === "#000000";
  const google = provider === "google";
  const backgroundColor = google ? (dark ? "#131314" : "#FFFFFF") : (dark ? "#FFFFFF" : "#000000");

  return (
    <Pressable
      testID={`sign-in-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={google ? "Sign in with Google" : "Continue with Apple"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: google ? (dark ? "#8E918F" : "#747775") : backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.content}>
        {google ? (
          <Image
            source={dark
              ? require("../../assets/auth/google-content-dark.png")
              : require("../../assets/auth/google-content-light.png")}
            style={styles.googleContent}
            contentFit="contain"
            accessible={false}
          />
        ) : (
          <>
            <Image
              source={dark ? require("../../assets/auth/apple-black.svg") : require("../../assets/auth/apple-white.svg")}
              style={styles.appleLogo}
              contentFit="contain"
              accessible={false}
            />
            <Text selectable={false} style={[styles.appleText, { color: dark ? "#000000" : "#FFFFFF" }]}>
              Continue with Apple
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", minHeight: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", maxWidth: "100%" },
  googleContent: { width: 242, maxWidth: "100%", height: 31 },
  appleLogo: { width: 27.3, height: 50 },
  appleText: { fontSize: 22, fontWeight: "500", flexShrink: 1, paddingVertical: 10 },
});
