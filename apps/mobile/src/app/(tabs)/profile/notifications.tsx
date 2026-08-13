import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Switch } from "react-native";
import {
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { api } from "../../../lib/trpc";

type NotificationPreferences = {
  onlyWhenInvolved: boolean;
  summarizeBursts: boolean;
};

const defaultPreferences: NotificationPreferences = {
  onlyWhenInvolved: false,
  summarizeBursts: false,
};

export default function NotificationSettingsScreen() {
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const saved = useRef<NotificationPreferences>(defaultPreferences);
  const draft = useRef<NotificationPreferences>(defaultPreferences);
  const initializedUser = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!profile.data || initializedUser.current === profile.data.userId) return;
    const initial = {
      onlyWhenInvolved: profile.data.notificationOnlyWhenInvolved ?? false,
      summarizeBursts: profile.data.summarizeNotificationBursts ?? false,
    };
    initializedUser.current = profile.data.userId;
    saved.current = initial;
    draft.current = initial;
    setPreferences(initial);
  }, [profile.data]);

  const update = api.profile.updateNotificationPreferences.useMutation({
    onSuccess(updated) {
      const next = {
        onlyWhenInvolved: updated.notificationOnlyWhenInvolved,
        summarizeBursts: updated.summarizeNotificationBursts,
      };
      saved.current = next;
      draft.current = next;
      setPreferences(next);
      utils.profile.me.setData(undefined, updated);
    },
    onError() {
      draft.current = saved.current;
      setPreferences(saved.current);
    },
  });

  function savePreference(
    key: keyof NotificationPreferences,
    value: boolean,
  ) {
    const next = { ...draft.current, [key]: value };
    draft.current = next;
    setPreferences(next);
    update.mutate(next);
  }

  if (profile.isPending) {
    return (
      <Screen background="sheet">
        <LoadingState />
      </Screen>
    );
  }

  return (
    <>
      <Screen background="sheet" contentContainerStyle={{ paddingTop: 12 }}>
        <Section
          footer="Smart summaries wait up to 5 minutes. One or two updates still arrive separately; three or more from the same group are combined."
        >
          <ListRow
            title="Only when involved"
            subtitle="Skip expenses you didn't pay for or share"
            trailing={
              <Switch
                accessibilityLabel="Only when involved"
                disabled={update.isPending}
                value={preferences.onlyWhenInvolved}
                onValueChange={(value) =>
                  savePreference("onlyWhenInvolved", value)
                }
              />
            }
          />
          <RowDivider inset={16} />
          <ListRow
            title="Smart summaries"
            subtitle="Combine bursts of activity from the same group"
            trailing={
              <Switch
                accessibilityLabel="Smart summaries"
                disabled={update.isPending}
                value={preferences.summarizeBursts}
                onValueChange={(value) =>
                  savePreference("summarizeBursts", value)
                }
              />
            }
          />
        </Section>
        {profile.error ? <ErrorState message={profile.error.message} /> : null}
        {update.error ? <ErrorState message={update.error.message} /> : null}
      </Screen>
      {process.env.EXPO_OS !== "ios" ? (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <HeaderButton
                label="Close notification settings"
                glyph="×"
                onPress={() => router.back()}
              />
            ),
          }}
        />
      ) : null}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Close notification settings"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
    </>
  );
}
