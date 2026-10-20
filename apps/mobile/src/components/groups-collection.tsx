import { useTheme } from "../theme";
import { View } from "react-native";
import { ActivityGroupRow } from "./activity-group-row";
import { usePushOnce } from "../lib/use-push-once";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { normalizeGroupIconKey } from "./group-icon";
import { GroupListSummary } from "./group-list-row";
import { ArchiveLink } from "./archive-link";
import {
  Screen,
  EmptyState,
  Intro,
  ErrorState,
  HeaderButton,
  LoadingState,
  PrimaryButton,
} from "./ui";
import { overallGroupBalanceLines } from "../lib/group-balance-summary";
import { toolbarIcons } from "../lib/toolbar-icons";
import { api } from "../lib/trpc";
import { useListAction } from "../lib/use-list-action";

export function GroupsCollection({ archived = false }: { archived?: boolean }) {
  const theme = useTheme();
  const groups = api.groups.list.useQuery(
    archived ? { archived: true } : undefined,
  );
  const archivedCount = api.groups.archivedCount.useQuery(undefined, {
    enabled: !archived,
  });
  useFocusEffect(
    useCallback(() => {
      void groups.refetch();
      if (!archived) void archivedCount.refetch();
    }, [groups.refetch, archivedCount.refetch, archived]),
  );
  const utils = api.useUtils();
  const confirm = useListAction();
  const push = usePushOnce();
  const archive = api.groups.archive.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.archivedCount.invalidate(),
      ]),
  });
  const restore = api.groups.restore.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.archivedCount.invalidate(),
      ]),
  });
  const pending = archive.isPending || restore.isPending;
  const rows = (groups.data ?? []).map((group) => ({
    key: group.id,
    backgroundColor: theme.background,
    actionColor: "#FF9500",
    deleteLabel: archived ? "Restore group" : "Archive group",
    actionTitle: archived ? "Restore" : "Archive",
    actionIcon: archived ? "arrow.uturn.backward" : "archivebox",
    deletionDisabled: pending,
    onDelete: () =>
      confirm({
        confirmation: false,
        title: archived ? "Restore group?" : "Archive group?",
        message: archived
          ? "The group will return to your active list."
          : "This hides the group only for you. Your balance must be settled. You can restore it from Archived Groups.",
        label: archived ? "Restore" : "Archive",
        perform: () =>
          archived
            ? restore.mutateAsync({ groupId: group.id })
            : archive.mutateAsync({
                groupId: group.id,
                expectedVersion: group.version,
              }),
      }),
    content: (
      <ActivityGroupRow
        {...group}
        iconKey={normalizeGroupIconKey(group.iconKey)}
        onPress={() => push(`/groups/${group.id}`)}
      />
    ),
  }));
  return (
    <>
      <Screen
        activityList={{
          appearance: "plain",
          sections: rows.length
            ? [{ key: "groups", label: "", data: rows }]
            : [],
          ...(!archived
            ? {
                footer: (
                  <ArchiveLink
                    label="Archived Groups"
                    count={archivedCount.data}
                    onPress={() => push("/groups/archived")}
                  />
                ),
              }
            : {}),
        }}
        refreshing={groups.isRefetching}
        onRefresh={() =>
          archived
            ? groups.refetch()
            : Promise.all([groups.refetch(), archivedCount.refetch()])
        }
      >
        {groups.isPending ? <LoadingState /> : null}
        {groups.error ? (
          <ErrorState
            message={groups.error.message}
            onRetry={() => void groups.refetch()}
          />
        ) : null}
        {groups.data?.length === 0 ? (
          <EmptyState
            title={
              archived ? "No archived groups" : "Make space for a shared plan"
            }
            message={
              archived
                ? "Groups you archive will appear here. Swipe left to restore them."
                : "Create a group for a trip, household, event, or anything else you split together."
            }
            action={
              !archived ? (
                <PrimaryButton
                  label="Create a group"
                  onPress={() => push("/groups/new")}
                  compact
                />
              ) : undefined
            }
          />
        ) : null}
        {!archived && groups.data?.length ? (
          <GroupListSummary lines={overallGroupBalanceLines(groups.data)} />
        ) : null}
        {archived && rows.length > 0 ? (
          <View>
            <Intro>
              {rows.length} archived {rows.length === 1 ? "group" : "groups"}
            </Intro>
          </View>
        ) : null}
      </Screen>
      <Stack.Screen
        options={{
          title: archived ? "Archived Groups" : "Groups",
          ...(process.env.EXPO_OS !== "ios" &&
            !archived && {
              headerRight: () => (
                <HeaderButton
                  label="Create a group"
                  glyph="+"
                  onPress={() => push("/groups/new")}
                />
              ),
            }),
        }}
      />
      {!archived ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={toolbarIcons.add}
            accessibilityLabel="Create a group"
            onPress={() => push("/groups/new")}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
