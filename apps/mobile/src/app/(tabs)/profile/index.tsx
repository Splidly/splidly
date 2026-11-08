import type { CurrencyCode } from "@splidly/shared";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import * as Application from "expo-application";
import { ErrorState, LoadingState, Screen } from "../../../components/ui";
import { ProfileSettingsScreen } from "../../../components/profile-settings-screen";
import { ProfileFooter, ProfileIdentity, ProfileSection, ProfileSettingRow } from "../../../components/profile-settings";
import { beginCurrencySelection } from "../../../lib/currency-selection";
import { getCurrency } from "../../../lib/currencies";
import { useNavigationPressGuard } from "../../../lib/use-navigation-press-guard";
import { usePushOnce } from "../../../lib/use-push-once";
import { authClient } from "../../../lib/auth-client";
import { useConnectivity } from "../../../lib/connectivity";
import { APP_URL } from "../../../lib/env";
import {
  clearLocalAccountData,
  clearLocalAuthSession,
} from "../../../lib/local-account-data";
import { friendlyErrorMessage } from "../../../lib/network";
import {
  getExistingPushInstallationId,
  unregisterNativePushNotifications,
} from "../../../lib/push-installation";
import { api } from "../../../lib/trpc";

const RECENT_SIGN_IN_ERROR = "Sign in again before deleting your account";

export default function ProfileScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profile = api.profile.me.useQuery(undefined, { enabled: !isSigningOut });
  const { isOnline } = useConnectivity();
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const push = usePushOnce();
  const acceptCurrencyPress = useNavigationPressGuard();
  const [accountError, setAccountError] = useState<string>();
  const signingOut = useRef(false);

  const update = api.profile.update.useMutation({
    async onSuccess(updated) {
      if (!updated) return;
      utils.profile.me.setData(undefined, updated);
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.invalidate(),
      ]);
    },
  });

  function chooseCurrency() {
    const current = profile.data;
    if (!current || update.isPending || !isOnline || !acceptCurrencyPress()) return;
    beginCurrencySelection(current.homeCurrency as CurrencyCode, (homeCurrency) => {
      if (homeCurrency === current.homeCurrency) return;
      update.mutate({ displayName: current.displayName, homeCurrency });
    });
    push("/currency-picker");
  }

  const remove = api.profile.deleteAccount.useMutation({
    async onSuccess(result) {
      await unregisterNativePushNotifications().catch(() => {});
      await authClient.signOut().catch(() => {
        // Server sessions are already gone after successful deletion.
      });
      await clearLocalAccountData().catch(() => {
        // Continue to the signed-out state even if secure storage is unavailable.
      });
      queryClient.clear();
      router.replace("/sign-in");
      if (result.manualAppleRevocationRequired) {
        Alert.alert(
          "Account deleted",
          "Splidly could not automatically revoke its Apple authorization. Remove Splidly manually in your Apple Account's Sign in with Apple settings.",
        );
      }
    },
    onError(error) {
      if (error.message !== RECENT_SIGN_IN_ERROR) return;
      Alert.alert(
        "Sign in again",
        "For security, sign in again before deleting your account.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign in",
            onPress: () => {
              void authClient.signOut().finally(async () => {
                await clearLocalAuthSession().catch(() => {});
                queryClient.clear();
                router.replace("/sign-in");
              });
            },
          },
        ],
      );
    },
  });
  const unregisterPush = api.push.unregister.useMutation();

  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    setIsSigningOut(true);
    setAccountError(undefined);
    try {
      const installationId = await getExistingPushInstallationId();
      if (installationId) {
        await unregisterPush.mutateAsync({ installationId }).catch(() => {
          // The server will disable a stale installation after APNs rejects it.
        });
      }
      await unregisterNativePushNotifications().catch(() => {
        // Native token cleanup is best effort and must not strand the account.
      });
      // Cancel protected reads before revoking the cookie. Keep the profile
      // query disabled until this route unmounts after a successful logout.
      await queryClient.cancelQueries();
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      queryClient.clear();
      router.replace("/sign-in");
    } catch (cause) {
      setAccountError(friendlyErrorMessage(cause, "Could not sign out"));
      setIsSigningOut(false);
    } finally {
      signingOut.current = false;
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Permanently delete account?",
      "Your profile, sign-in connections, sessions, invitations, notifications, and private app data will be removed. Shared groups, expenses, settlements, descriptions, notes, amounts, dates, and splits remain unchanged so every participant's balance stays correct. Your name is shown as “Deleted user.” This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => remove.mutate({ confirmation: "DELETE" }),
        },
      ],
    );
  }

  const current = profile.data;
  const accountBusy = isSigningOut || remove.isPending;
  const notificationsEnabled = current?.notificationsEnabled !== false;

  if (isSigningOut) {
    return <Screen><LoadingState /></Screen>;
  }

  return (
    <ProfileSettingsScreen>
      {profile.isPending ? <LoadingState /> : null}
      {current ? (
        <ProfileIdentity
          name={current.displayName}
          userId={current.userId}
          imageUrl={current.avatarUrl}
          disabled={accountBusy}
          onPress={() => push("/profile/edit")}
        />
      ) : null}
      <ProfileSection title="Preferences" footer="Currency changes apply to new entries only. Historical balances stay in their original buckets.">
        <ProfileSettingRow
          title="Home currency"
          subtitle={getCurrency(current?.homeCurrency ?? "EUR")?.name ?? current?.homeCurrency}
          value={current?.homeCurrency}
          icon="currency"
          disabled={!current || update.isPending || accountBusy || !isOnline}
          onPress={chooseCurrency}
        />
        <ProfileSettingRow
          title="Notifications"
          subtitle="Expense and payment updates"
          value={notificationsEnabled ? "On" : "Off"}
          icon="notifications"
          divider
          disabled={accountBusy}
          onPress={() => push("/profile/notifications")}
        />
      </ProfileSection>
      {update.error ? <ErrorState message={update.error.message} /> : null}
      <ProfileSection title="Legal & support">
        <ProfileSettingRow title="Terms of Service" icon="terms" onPress={() => void Linking.openURL(`${APP_URL}/terms`)} />
        <ProfileSettingRow title="Privacy policy" icon="privacy" divider onPress={() => void Linking.openURL(`${APP_URL}/privacy`)} />
        <ProfileSettingRow title="Legal notice" icon="info" divider onPress={() => void Linking.openURL(`${APP_URL}/legal`)} />
        <ProfileSettingRow title="Report content or abuse" icon="report" divider onPress={() => void Linking.openURL(`${APP_URL}/report`)} />
      </ProfileSection>
      <ProfileSection title="Account">
        <ProfileSettingRow
          title={isSigningOut ? "Signing out…" : "Sign out"}
          icon="signOut"
          showsDisclosureIndicator={false}
          disabled={accountBusy}
          onPress={() => void signOut()}
        />
        <ProfileSettingRow
          title={remove.isPending ? "Deleting account…" : "Delete account"}
          icon="delete"
          destructive
          divider
          showsDisclosureIndicator={false}
          disabled={accountBusy}
          onPress={confirmDelete}
        />
      </ProfileSection>
      {remove.error ? <ErrorState message={remove.error.message} /> : null}
      {accountError ? <ErrorState message={accountError} /> : null}
      {profile.error ? (
        <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} />
      ) : null}
      <ProfileFooter version={Application.nativeApplicationVersion} />
    </ProfileSettingsScreen>
  );
}
