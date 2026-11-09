import { ActivityFriendRow } from "./activity-friend-row";
import { usePushOnce } from "../lib/use-push-once";
import { ArchiveLink } from "./archive-link";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useColorScheme } from "react-native";
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
import { friendPreview } from "../lib/activity-preview";
import { friendPreviewActions } from "../lib/activity-preview-actions";
import type { CurrencyCode } from "@splidly/shared";

export function FriendsCollection({ settled = false }: { settled?: boolean }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const friends = api.friends.list.useQuery({ includeArchived: true });
  useFocusEffect(
    useCallback(() => {
      void friends.refetch();
    }, [friends.refetch]),
  );
  const push = usePushOnce();
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) => void shareInvite(invite.url),
  });

  const settledFriends = (friends.data ?? []).filter((friend) => friend.canArchive);
  const visibleFriends = (friends.data ?? []).filter((friend) => friend.canArchive === settled);
  const rows = visibleFriends.map(({ friendship, friend, balances }) => {
    const name = friend?.displayName ?? "Deleted user";
    return {
      key: friendship.id,
      ...(process.env.EXPO_OS === "ios" && {
        onPress: () => push(`/friends/${friendship.id}`),
        preview: friendPreview(name, friend?.avatarUrl, balances, { userId: friend?.userId ?? friendship.id, scheme }),
        onPreviewOpen: () => push(`/friends/${friendship.id}`),
        previewActions: friendPreviewActions(friendship.id, friend?.userId,
          (balances.find((balance) => balance.contextType === "friend")?.canonicalAmount.currency ?? friend?.homeCurrency ?? "EUR") as CurrencyCode, push),
      }),
      nativeContent: process.env.EXPO_OS === "ios",
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
          balance={balances[0] && (
            BigInt(balances[0].viewerAmount.minor) !== 0n
              ? balances[0].viewerAmount
              : BigInt(balances[0].canonicalAmount.minor) !== 0n
                ? balances[0].canonicalAmount
                : balances[0].counterpartyAmount
          )}
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
            ? [{
                key: "friends",
                label: `${rows.length} ${rows.length === 1 ? "friend" : "friends"}`,
                data: rows,
              }]
            : [],
          ...(!settled && friends.data !== undefined
            ? {
                footer: (
                  <ArchiveLink
                    label="Settled Friends"
                    icon="settled"
                    count={friends.data ? settledFriends.length : undefined}
                    onPress={() => push("/friends/archived")}
                  />
                ),
              }
            : {}),
        }}
        refreshing={friends.isRefetching}
        onRefresh={() => friends.refetch()}
      >
        {friends.isPending ? <LoadingState /> : null}
        {friends.error ? (
          <ErrorState
            message={friends.error.message}
            onRetry={() => void friends.refetch()}
          />
        ) : null}
        {friends.data && visibleFriends.length === 0 ? (
          <EmptyState
            title={
              settled
                ? "No settled friends yet"
                : settledFriends.length > 0
                  ? "All settled up"
                  : "Your people will appear here"
            }
            message={
              settled
                ? "Friends appear here automatically once all your shared balances are settled."
                : settledFriends.length > 0
                  ? "You have no outstanding balances. Find your settled friends below."
                  : "Invite a friend to start a private ledger, or join a group and connect automatically."
            }
            action={
              settled ? undefined : (
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
      </Screen>
      <Stack.Screen
        options={{
          title: settled ? "Settled Friends" : "Friends",
          ...(process.env.EXPO_OS !== "ios" &&
            !settled && {
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
      {!settled ? (
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
