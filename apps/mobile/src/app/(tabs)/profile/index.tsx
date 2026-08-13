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
import { APP_URL } from "../../../lib/env";
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

const ACTIVE_GROUPS_ERROR = "Leave all groups before deleting your account";

export default function ProfileScreen() {
  const profile = api.profile.me.useQuery();
  const groups = api.groups.list.useQuery();
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const initializedUser = useRef<string | undefined>(undefined);
  const saved = useRef<SavedProfile | undefined>(undefined);
  const lastAttempted = useRef<string | undefined>(undefined);

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
    if (!initializedUser.current || update.isPending) return;
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
  }, [avatarUrl, currency, name, update.isPending]);

  const remove = api.profile.deleteAccount.useMutation({
    async onSuccess() {
      await unregisterNativePushNotifications().catch(() => {});
      queryClient.clear();
      await authClient.signOut();
      router.replace("/sign-in");
    },
    onError(error, input) {
      if (!input.leaveGroups && error.message === ACTIVE_GROUPS_ERROR) {
        confirmLeaveGroupsAndDelete();
      }
    },
  });
  const unregisterPush = api.push.unregister.useMutation();

  async function signOut() {
    const installationId = await getExistingPushInstallationId();
    if (installationId) {
      await unregisterPush.mutateAsync({ installationId }).catch(() => {
        // Signing out must still succeed while offline.
      });
    }
    await unregisterNativePushNotifications().catch(() => {
      // APNs invalidates the token when possible. The server also disables it
      // after APNs rejects a delivery to a signed-out installation.
    });
    queryClient.clear();
    await authClient.signOut();
    router.replace("/sign-in");
  }

  function deleteAccount(leaveGroups = false) {
    remove.mutate({ confirmation: "DELETE", leaveGroups });
  }

  function confirmLeaveGroupsAndDelete() {
    const groupCount = groups.data?.length;
    const membershipDescription = groupCount
      ? `You're still a member of ${groupCount} ${
          groupCount === 1 ? "group" : "groups"
        }.`
      : "You're still a member of one or more groups.";
    Alert.alert(
      "Leave groups and delete account?",
      `${membershipDescription} Splidly can leave them all and then permanently delete your account. All balances must be settled first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave & Delete",
          style: "destructive",
          onPress: () => deleteAccount(true),
        },
      ],
    );
  }

  function startAccountDeletion() {
    if (groups.data && groups.data.length > 0) {
      confirmLeaveGroupsAndDelete();
      return;
    }
    deleteAccount();
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "All balances must be settled. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: startAccountDeletion,
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
          title="Privacy policy"
          subtitle="How Splidly collects, uses, and retains your data"
          onPress={() => void Linking.openURL(`${APP_URL}/privacy`)}
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
    </Screen>
  );
}
