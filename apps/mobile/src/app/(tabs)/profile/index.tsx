import type {
  CurrencyCode,
  CustomImageDataUrl,
} from "@splidly/shared";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  ListRow,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { CurrencyField } from "../../../components/currency-field";
import { PictureEditor } from "../../../components/picture-editor";
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

type SavedProfile = {
  displayName: string;
  homeCurrency: CurrencyCode;
  avatarUrl: string | null;
};

const RECENT_SIGN_IN_ERROR = "Sign in again before deleting your account";

export default function ProfileScreen() {
  const profile = api.profile.me.useQuery();
  const { isOnline } = useConnectivity();
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string>();
  const initializedUser = useRef<string | undefined>(undefined);
  const saved = useRef<SavedProfile | undefined>(undefined);
  const lastAttempted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isOnline) lastAttempted.current = undefined;
  }, [isOnline]);

  useEffect(() => {
    if (!profile.data || initializedUser.current === profile.data.userId) return;
    const initial = {
      displayName: profile.data.displayName,
      homeCurrency: profile.data.homeCurrency as CurrencyCode,
      avatarUrl: profile.data.avatarUrl ?? null,
    };
    initializedUser.current = profile.data.userId;
    saved.current = initial;
    setName(initial.displayName);
    setCurrency(initial.homeCurrency);
    setAvatarUrl(initial.avatarUrl);
  }, [profile.data]);

  const update = api.profile.update.useMutation({
    async onSuccess(updated) {
      if (!updated) return;
      saved.current = {
        displayName: updated.displayName,
        homeCurrency: updated.homeCurrency as CurrencyCode,
        avatarUrl: updated.avatarUrl,
      };
      lastAttempted.current = undefined;
      utils.profile.me.setData(undefined, updated);
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!initializedUser.current || update.isPending || !isOnline) return;
    const displayName = name.trim();
    const current = saved.current;
    const draftKey = `${displayName}\u0000${currency}\u0000${avatarUrl ?? ""}`;
    if (
      displayName.length === 0 ||
      lastAttempted.current === draftKey ||
      (current?.displayName === displayName &&
        current.homeCurrency === currency &&
        current.avatarUrl === avatarUrl)
    ) {
      return;
    }
    const timer = setTimeout(() => {
      lastAttempted.current = draftKey;
      update.mutate({
        displayName,
        homeCurrency: currency,
        ...(current?.avatarUrl !== avatarUrl
          ? { avatarUrl: avatarUrl as CustomImageDataUrl | null }
          : {}),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [avatarUrl, currency, isOnline, name, update.isPending]);

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
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      queryClient.clear();
      router.replace("/sign-in");
    } catch (cause) {
      setAccountError(friendlyErrorMessage(cause, "Could not sign out"));
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

  return (
    <Screen>
      <FormSection
        title="Profile"
        footer="Currency changes apply to new entries only. Historical balances stay in their original buckets."
      >
        <PictureEditor
          label="profile photo"
          imageUrl={avatarUrl}
          disabled={update.isPending}
          onImageChange={setAvatarUrl}
          preview={
            <Avatar
              name={name || profile.data?.displayName || "Splidly"}
              colorKey={profile.data?.userId}
              imageUrl={avatarUrl}
              size={88}
            />
          }
        />
        <Field
          label="Display name"
          value={name}
          onChangeText={setName}
        />
        <CurrencyField
          label="Home currency"
          value={currency}
          onValueChange={setCurrency}
        />
      </FormSection>
      <Section title="Preferences">
        <ListRow
          title="Notifications"
          subtitle="Choose which expense updates reach you"
          onPress={() => router.push("/profile/notifications")}
        />
      </Section>
      <Section title="Privacy">
        <ListRow
          title="Terms of Service"
          subtitle="Eligibility, acceptable use, and service rules"
          showsDisclosureIndicator
          onPress={() => void Linking.openURL(`${APP_URL}/terms`)}
        />
        <RowDivider inset={16} />
        <ListRow
          title="Privacy policy"
          subtitle="How Splidly collects, uses, and retains your data"
          showsDisclosureIndicator
          onPress={() => void Linking.openURL(`${APP_URL}/privacy`)}
        />
        <RowDivider inset={16} />
        <ListRow
          title="Legal notice"
          subtitle="Operator and contact information"
          showsDisclosureIndicator
          onPress={() => void Linking.openURL(`${APP_URL}/legal`)}
        />
        <RowDivider inset={16} />
        <ListRow
          title="Report content or abuse"
          subtitle="Contact the moderation channel"
          showsDisclosureIndicator
          onPress={() => void Linking.openURL(`${APP_URL}/report`)}
        />
      </Section>
      <Section title="Account">
        <ListRow
          title="Sign out"
          showsDisclosureIndicator={false}
          onPress={() => void signOut()}
        />
        <RowDivider inset={16} />
        <ListRow
          title="Delete account"
          destructive
          showsDisclosureIndicator={false}
          onPress={confirmDelete}
        />
      </Section>
      {update.error ? <ErrorState message={update.error.message} /> : null}
      {remove.error ? <ErrorState message={remove.error.message} /> : null}
      {accountError ? <ErrorState message={accountError} /> : null}
      {profile.error ? (
        <ErrorState
          message={profile.error.message}
          onRetry={() => void profile.refetch()}
        />
      ) : null}
    </Screen>
  );
}
