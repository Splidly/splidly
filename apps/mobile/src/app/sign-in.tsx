import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import { useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../components/app-icon";
import {
  ErrorState,
  PrimaryButton,
  Screen,
} from "../components/ui";
import { authClient, signInAsDemo } from "../lib/auth-client";
import { isAppleSignInCancellation } from "../lib/auth-errors";
import { APP_URL } from "../lib/env";
import { friendlyErrorMessage } from "../lib/network";
import { pendingInvite } from "../lib/pending-invite";
import { profileNavigationState } from "../lib/profile-navigation";
import { api } from "../lib/trpc";
import { useTheme } from "../theme";

GoogleSignin.configure({
  ...(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    ? { webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }
    : {}),
  ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
    : {}),
});

const authCallbackPath = "/sign-in" as const;

export default function SignInScreen() {
  const theme = useTheme();
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const profile = api.profile.me.useQuery(undefined, {
    enabled: Boolean(session.data?.user),
  });
  const handledUserId = useRef<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const signingIn = useRef(false);
  const [error, setError] = useState<string>();
  const profileState = profileNavigationState(profile);
  const profileError = profile.error
    ? friendlyErrorMessage(profile.error, "Could not load your profile")
    : undefined;

  useEffect(() => {
    const userId = session.data?.user.id;
    if (!userId) {
      handledUserId.current = undefined;
      return;
    }
    if (
      profileState === "pending" ||
      profileState === "error" ||
      handledUserId.current === userId
    ) {
      return;
    }
    handledUserId.current = userId;
    if (profileState === "onboarding") {
      router.push("/onboarding");
      return;
    }
    void pendingInvite.get().then((token) => {
      router.replace(token ? `/invite/${token}` : "/(tabs)/friends");
    });
  }, [
    profileState,
    session.data?.user?.id,
  ]);

  async function finishSignIn() {
    queryClient.clear();
    await session.refetch();
  }

  async function signInGoogle() {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("Google did not return an identity token");
      const result = await authClient.signIn.social({
        provider: "google",
        idToken: { token: idToken },
        callbackURL: authCallbackPath,
      });
      if (result.error) throw new Error(result.error.message);
      await finishSignIn();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Google sign-in failed"));
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }

  async function signInApple() {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (process.env.EXPO_OS === "ios") {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error("Apple did not return an identity token");
        }
        const fullName = credential.fullName
          ? AppleAuthentication.formatFullName(credential.fullName).trim()
          : "";
        const result = await authClient.signIn.social({
          provider: "apple",
          idToken: {
            token: credential.identityToken,
            ...(fullName
              ? { user: { name: { firstName: fullName } } }
              : {}),
          },
          callbackURL: authCallbackPath,
        });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.social({
          provider: "apple",
          callbackURL: authCallbackPath,
        });
        if (result.error) throw new Error(result.error.message);
      }
      await finishSignIn();
    } catch (cause) {
      if (isAppleSignInCancellation(cause)) return;
      setError(friendlyErrorMessage(cause, "Apple sign-in failed"));
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }

  async function signInDemo() {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await signInAsDemo();
      await finishSignIn();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Demo sign-in failed"));
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }

  const googleButton = (
    <GoogleSigninButton
      testID="sign-in-google"
      size={GoogleSigninButton.Size.Wide}
      color={GoogleSigninButton.Color.Light}
      onPress={() => void signInGoogle()}
      disabled={busy}
      style={styles.providerButton}
    />
  );
  const appleButton = process.env.EXPO_OS === "ios" ? (
    <View
      style={styles.fullWidth}
      pointerEvents={busy ? "none" : "auto"}
      accessibilityState={{ disabled: busy }}
    >
      <AppleAuthentication.AppleAuthenticationButton
        testID="sign-in-apple"
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          theme.background === "#000000"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={12}
        style={[styles.providerButton, { opacity: busy ? 0.5 : 1 }]}
        onPress={() => void signInApple()}
      />
    </View>
  ) : (
    <PrimaryButton
      label="Continue with Apple"
      onPress={() => void signInApple()}
      disabled={busy}
      tone="secondary"
    />
  );

  return (
    <Screen accountForTopInset contentContainerStyle={styles.screen}>
      <View style={styles.welcomeArea}>
        <View style={[styles.content, styles.welcome]}>
          <View style={styles.brand}>
            <AppIcon size={44} />
            <Text selectable={false} style={[styles.wordmark, { color: theme.text }]}>Splidly</Text>
          </View>
          <View style={styles.intro}>
            <Text selectable={false} accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
              A simpler way{`\n`}to split expenses.
            </Text>
            <Text selectable={false} style={[styles.description, { color: theme.muted }]}>
              Trips, dinners, and everyday costs.{`\n`}Keep track together, settle up easily.
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.content, styles.signIn]}>
        <View style={styles.actions}>
          <View testID="sign-in-providers" style={styles.providers}>
            <View
              style={[styles.providerButtons, { opacity: busy ? 0 : 1 }]}
              pointerEvents={busy ? "none" : "auto"}
              accessibilityElementsHidden={busy}
              importantForAccessibility={busy ? "no-hide-descendants" : "auto"}
            >
              {process.env.EXPO_OS === "ios" ? googleButton : appleButton}
              {process.env.EXPO_OS === "ios" ? appleButton : googleButton}
            </View>
            {busy ? (
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Signing in"
                accessibilityLiveRegion="polite"
                style={[styles.progress, { backgroundColor: theme.background }]}
              >
                <ActivityIndicator color={theme.muted} />
                <Text selectable={false} style={[styles.smallText, { color: theme.muted }]}>Signing you in…</Text>
              </View>
            ) : null}
          </View>
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void signInDemo()}
              style={({ pressed }) => [styles.demoButton, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
            >
              <Text selectable={false} style={[styles.demoText, { color: theme.muted }]}>Try the demo</Text>
            </Pressable>
          ) : null}
          {error || profileError ? (
            <ErrorState
              message={error ?? profileError ?? "Could not load your profile"}
              {...(!error && profile.error ? { onRetry: () => void profile.refetch() } : {})}
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text selectable={false} style={[styles.legalText, { color: theme.muted }]}>
            By continuing, you agree to the{" "}
            <Text selectable={false} accessibilityRole="link" style={{ color: theme.primary }} onPress={() => void Linking.openURL(`${APP_URL}/terms`)}>Terms of Service</Text>
            {" "}and acknowledge the{" "}
            <Text selectable={false} accessibilityRole="link" style={{ color: theme.primary }} onPress={() => void Linking.openURL(`${APP_URL}/privacy`)}>Privacy Notice</Text>.
            {" "}
            <Text selectable={false} accessibilityRole="link" style={{ color: theme.primary }} onPress={() => void Linking.openURL(`${APP_URL}/legal`)}>Legal notice</Text>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 32 },
  content: { width: "100%", maxWidth: 380, alignSelf: "center" },
  // Only this child takes up spare space. The shared scroll container keeps
  // its measured minimum height and can still overflow on smaller devices.
  welcomeArea: { flexGrow: 1, flexShrink: 0, justifyContent: "center", paddingVertical: 24 },
  welcome: { alignItems: "center", gap: 28 },
  signIn: { gap: 24 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  wordmark: { fontSize: 23, fontWeight: "700", letterSpacing: -0.6 },
  intro: { alignSelf: "stretch", gap: 14 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "700", letterSpacing: -1, textAlign: "center" },
  description: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  actions: { gap: 12 },
  providers: { position: "relative" },
  providerButtons: { gap: 12 },
  providerButton: { width: "100%", height: 52 },
  fullWidth: { width: "100%" },
  progress: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 12 },
  demoButton: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  demoText: { fontSize: 14, fontWeight: "500" },
  footer: { alignItems: "center" },
  smallText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  legalText: { fontSize: 13, lineHeight: 20, textAlign: "center" },
});
