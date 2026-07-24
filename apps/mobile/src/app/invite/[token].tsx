import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import {
  Avatar,
  ErrorState,
  LoadingState,
  PrimaryButton,
  Screen,
  Section,
} from "../../components/ui";
import { authClient } from "../../lib/auth-client";
import { pendingInvite } from "../../lib/pending-invite";
import { api } from "../../lib/trpc";
import { useTheme } from "../../theme";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const session = authClient.useSession();
  const preview = api.invites.preview.useQuery({ token });
  const utils = api.useUtils();
  const accept = api.invites.accept.useMutation({
    async onSuccess(result) {
      await pendingInvite.clear();
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
      ]);
      router.replace(
        result.kind === "group"
          ? `/groups/${result.groupId}`
          : result.friendshipId
            ? `/friends/${result.friendshipId}`
            : "/(tabs)/friends",
      );
    },
  });
  useEffect(() => {
    if (session.data?.user) return;
    void pendingInvite.set(token);
  }, [session.data?.user, token]);

  if (preview.isPending) return <Screen><LoadingState /></Screen>;
  if (preview.error || !preview.data) {
    return <Screen><ErrorState message={preview.error?.message} /></Screen>;
  }
  const isGroup = preview.data.kind === "group";
  const subject = isGroup
    ? preview.data.group?.name ?? "this group"
    : preview.data.inviter?.displayName ?? "a friend";
  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 24 }}>
        <Avatar name={subject} size={82} variant={isGroup ? "group" : "person"} />
        <Text
          style={{
            color: theme.text,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: "700",
            textAlign: "center",
            letterSpacing: -0.5,
          }}
        >
          {isGroup ? `Join ${subject}` : `Connect with ${subject}`}
        </Text>
        <Text
          style={{
            color: theme.muted,
            fontSize: 16,
            lineHeight: 23,
            textAlign: "center",
          }}
        >
          Invited by {preview.data.inviter?.displayName ?? "a Splidly user"}.
          Nothing is added until you accept.
        </Text>
      </View>
      <Section>
        <View style={{ padding: 16 }}>
          {session.data?.user ? (
            <PrimaryButton
              label={accept.isPending ? "Joining…" : "Accept invitation"}
              disabled={accept.isPending}
              onPress={() => accept.mutate({ token })}
            />
          ) : (
            <PrimaryButton
              label="Sign in to continue"
              onPress={() => router.push("/sign-in")}
            />
          )}
        </View>
      </Section>
      {accept.error ? <ErrorState message={accept.error.message} /> : null}
    </Screen>
  );
}
