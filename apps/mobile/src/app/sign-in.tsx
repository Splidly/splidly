import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import { useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
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
      setBusy(false);
    }
  }

  async function signInApple() {
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
      setBusy(false);
    }
  }

  async function signInDemo() {
    setBusy(true);
    setError(undefined);
    try {
      await signInAsDemo();
      await finishSignIn();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Demo sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      bounces={false}
      accountForTopInset
      contentContainerStyle={{
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: 24 }}>
        <AppIcon size={68} />
        <View style={{ gap: 12 }}>
          <Text
            selectable={false}
            style={{
              color: theme.text,
              fontSize: 40,
              lineHeight: 44,
              fontWeight: "800",
              letterSpacing: -1.4,
            }}
          >
            Split the cost.{`\n`}Keep the friendship.
          </Text>
          <Text
            selectable={false}
            style={{ color: theme.muted, fontSize: 17, lineHeight: 24 }}
          >
            A private, precise ledger for trips, homes, and everything friends
            pay for together.
          </Text>
        </View>
      </View>

      <View style={{ gap: 12, alignItems: "center" }}>
        {busy ? <ActivityIndicator color={theme.primary} /> : null}
        <Text
          selectable={false}
          style={{
            color: theme.muted,
            textAlign: "center",
            fontSize: 12,
            lineHeight: 17,
            paddingHorizontal: 16,
          }}
        >
          By continuing, you agree to the Terms of Service and acknowledge the
          Privacy Notice.
        </Text>
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={
            theme.background === "#000000"
              ? GoogleSigninButton.Color.Dark
              : GoogleSigninButton.Color.Light
          }
          onPress={() => void signInGoogle()}
          disabled={busy}
          style={{ width: "100%", height: 52 }}
        />
        {process.env.EXPO_OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              theme.background === "#000000"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={{ width: "100%", height: 50 }}
            onPress={() => void signInApple()}
          />
        ) : (
          <View style={{ width: "100%" }}>
        <PrimaryButton
          label="Continue with Apple"
          onPress={() => void signInApple()}
          disabled={busy}
          tone="secondary"
        />
          </View>
        )}
        {__DEV__ ? (
          <View style={{ width: "100%" }}>
            <PrimaryButton
              label="Continue as Demo User"
              onPress={() => void signInDemo()}
              disabled={busy}
              tone="plain"
            />
          </View>
        ) : null}
        {error || profileError ? (
          <View style={{ width: "100%" }}>
            <ErrorState
              message={error ?? profileError ?? "Could not load your profile"}
              {...(!error && profile.error
                ? { onRetry: () => void profile.refetch() }
                : {})}
            />
          </View>
        ) : null}
        <Text
          selectable={false}
          style={{
            color: theme.muted,
            textAlign: "center",
            fontSize: 12,
            lineHeight: 17,
            paddingHorizontal: 16,
          }}
        >
          Splidly records shared accounting. It never moves your money.
        </Text>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}
        >
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${APP_URL}/terms`)}
          >
            <Text
              selectable={false}
              style={{ color: theme.primary, fontSize: 12 }}
            >
              Terms of Service
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${APP_URL}/privacy`)}
          >
            <Text
              selectable={false}
              style={{ color: theme.primary, fontSize: 12 }}
            >
              Privacy notice
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${APP_URL}/legal`)}
          >
            <Text
              selectable={false}
              style={{ color: theme.primary, fontSize: 12 }}
            >
              Legal notice
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
