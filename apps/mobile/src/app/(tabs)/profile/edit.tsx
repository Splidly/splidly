import type { CurrencyCode, CustomImageDataUrl } from "@splidly/shared";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState, Screen } from "../../../components/ui";
import { ProfileEditForm, ProfileEditAndroidActions } from "../../../components/profile-edit-form";
import { useConnectivity } from "../../../lib/connectivity";
import { api } from "../../../lib/trpc";
import { toolbarIcons } from "../../../lib/toolbar-icons";

export default function EditProfileScreen() {
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const { isOnline } = useConnectivity();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const initialized = useRef(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!profile.data || initialized.current) return;
    initialized.current = true;
    setName(profile.data.displayName);
    setAvatarUrl(profile.data.avatarUrl ?? null);
  }, [profile.data]);

  const update = api.profile.update.useMutation({
    async onSuccess(updated) {
      if (!updated) return;
      utils.profile.me.setData(undefined, updated);
      await Promise.all([utils.friends.list.invalidate(), utils.groups.invalidate()]);
    },
  });
  const displayName = name.trim();
  const valid = displayName.length > 0 && displayName.length <= 80;
  const changed = displayName !== profile.data?.displayName || avatarUrl !== (profile.data?.avatarUrl ?? null);
  const canSave = Boolean(profile.data) && valid && changed && isOnline && !update.isPending && !preparingPhoto;

  async function save() {
    if (!canSave || !profile.data || submitting.current) return;
    submitting.current = true;
    try {
      await update.mutateAsync({
        displayName,
        homeCurrency: profile.data.homeCurrency as CurrencyCode,
        ...(avatarUrl !== (profile.data.avatarUrl ?? null) ? { avatarUrl: avatarUrl as CustomImageDataUrl | null } : {}),
      });
      if (mounted.current) router.back();
    } catch {
      // Keep the draft open; the mutation's error is displayed below the fields.
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <Screen background="sheet">
        {process.env.EXPO_OS === "android" ? (
          <ProfileEditAndroidActions onCancel={() => router.back()} onSave={() => void save()} disabled={update.isPending} canSave={canSave} />
        ) : null}
        {profile.isPending ? <LoadingState /> : profile.data ? (
          <ProfileEditForm
            name={name}
            userId={profile.data.userId}
            imageUrl={avatarUrl}
            disabled={update.isPending}
            onNameChange={setName}
            onImageChange={setAvatarUrl}
            onPreparingChange={setPreparingPhoto}
            onSubmit={() => void save()}
          />
        ) : null}
        {profile.error ? <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} /> : null}
        {update.error ? <ErrorState message={update.error.message} /> : null}
      </Screen>
      <Stack.Screen options={{ title: "Edit profile", gestureEnabled: !update.isPending }} />
      {process.env.EXPO_OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon={toolbarIcons.close} accessibilityLabel="Cancel profile changes" disabled={update.isPending} onPress={() => router.back()} />
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button icon={toolbarIcons.done} accessibilityLabel="Save profile" disabled={!canSave} onPress={() => void save()} />
          </Stack.Toolbar>
        </>
      ) : null}
    </>
  );
}
