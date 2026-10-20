import { ActivityFriendRow } from "./activity-friend-row";
import { usePushOnce } from "../lib/use-push-once";
import { ArchiveLink } from "./archive-link";
import { useListAction } from "../lib/use-list-action";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";
import {
  Screen,
  EmptyState,
  ErrorState,
  HeaderButton,
  LoadingState,
  PrimaryButton,
} from "./ui";
import { toolbarIcons } from "../lib/toolbar-icons";
import { api } from "../lib/trpc";
import { shareInvite } from "../lib/share-invite";
import { useTheme } from "../theme";

export function FriendsCollection({
  archived = false,
}: {
  archived?: boolean;
}) {
  const theme = useTheme();
  const friends = api.friends.list.useQuery(
    archived ? { archived: true } : undefined,
  );
  const archivedCount = api.friends.archivedCount.useQuery(undefined, {
    enabled: !archived,
  });
  useFocusEffect(
    useCallback(() => {
      void friends.refetch();
      if (!archived) void archivedCount.refetch();
    }, [friends.refetch, archivedCount.refetch, archived]),
  );
  const utils = api.useUtils();
  const confirm = useListAction();
  const push = usePushOnce();
  const archive = api.friends.archive.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.friends.list.invalidate(),
        utils.friends.archivedCount.invalidate(),
      ]),
  });
  const restore = api.friends.restore.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.friends.list.invalidate(),
        utils.friends.archivedCount.invalidate(),
      ]),
  });
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) => void shareInvite(invite.url),
  });

  const rows = (friends.data ?? []).map(({ friendship, friend, balances }) => {
    const name = friend?.displayName ?? "Deleted user";
    return {
      key: friendship.id,
      actionTitle: archived ? "Restore" : "Archive",
      deleteLabel: archived ? "Restore friend" : "Archive friend",
      actionColor: "#FF9500",
      actionIcon: archived ? "arrow.uturn.backward" : "archivebox",
      deletionDisabled: archive.isPending || restore.isPending,
      onDelete: () =>
        confirm({
          confirmation: false,
          title: archived ? "Restore friend?" : "Archive friend?",
          message: archived
            ? "This friend will return to your active list."
            : "This hides the friend only for you. All balances must be settled. You can restore them from Archived Friends.",
          label: archived ? "Restore" : "Archive",
          perform: () =>
            archived
              ? restore.mutateAsync({ friendshipId: friendship.id })
              : archive.mutateAsync({ friendshipId: friendship.id }),
        }),
      content: (
        <ActivityFriendRow
          name={name}
          colorKey={friend?.userId ?? friendship.id}
          avatarUrl={friend?.avatarUrl}
          subtitle={
            balances.length === 0
              ? "All settled"
              : balances.length === 1
                ? balances[0]?.contextType === "group"
                  ? "1 group ledger"
                  : "Direct ledger"
                : `${balances.length} open ledgers`
          }
          balance={balances[0]?.viewerAmount}
          additionalBalances={Math.max(0, balances.length - 1)}
          onPress={() => push(`/friends/${friendship.id}`)}
        />
      ),
    };
  });
  return (
    <>
      <Screen
        activityList={{
          sections: rows.length
            ? [{ key: "friends", label: "", data: rows }]
            : [],
          ...(!archived
            ? {
                footer: (
                  <ArchiveLink
                    label="Archived Friends"
                    count={archivedCount.data}
                    onPress={() => push("/friends/archived")}
                  />
                ),
              }
            : {}),
        }}
        refreshing={friends.isRefetching}
        onRefresh={() =>
          archived
            ? friends.refetch()
            : Promise.all([friends.refetch(), archivedCount.refetch()])
        }
      >
        {friends.isPending ? <LoadingState /> : null}
        {friends.error ? (
          <ErrorState
            message={friends.error.message}
            onRetry={() => void friends.refetch()}
          />
        ) : null}
        {friends.data?.length === 0 ? (
          <EmptyState
            title={
              archived ? "No archived friends" : "Your people will appear here"
            }
            message={
              archived
                ? "Friends you archive will appear here. Swipe left to restore them."
                : "Invite a friend to start a private ledger, or join a group and connect automatically."
            }
            action={
              archived ? undefined : (
                <PrimaryButton
                  label={
                    createInvite.isPending
                      ? "Creating invite…"
                      : "Invite a friend"
                  }
                  onPress={() => createInvite.mutate({ kind: "friend" })}
                  disabled={createInvite.isPending}
                  compact
                />
              )
            }
          />
        ) : null}
        {createInvite.error ? (
          <ErrorState message={createInvite.error.message} />
        ) : null}
        {rows.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text
              selectable={false}
              style={{ color: theme.muted, fontSize: 14, fontWeight: "600" }}
            >
              {rows.length} {rows.length === 1 ? "friend" : "friends"}
            </Text>
          </View>
        ) : null}
      </Screen>
      <Stack.Screen
        options={{
          title: archived ? "Archived Friends" : "Friends",
          ...(process.env.EXPO_OS !== "ios" &&
            !archived && {
              headerRight: () => (
                <HeaderButton
                  label="Invite a friend"
                  glyph="Invite"
                  disabled={createInvite.isPending}
                  onPress={() => createInvite.mutate({ kind: "friend" })}
                />
              ),
            }),
        }}
      />
      {!archived ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={toolbarIcons.invite}
            accessibilityLabel="Invite a friend"
            disabled={createInvite.isPending}
            onPress={() => createInvite.mutate({ kind: "friend" })}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
