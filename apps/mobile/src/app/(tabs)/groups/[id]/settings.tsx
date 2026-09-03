import type { CurrencyCode } from "@splidly/shared";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, PlatformColor, Switch, View } from "react-native";
import type { GroupBalanceMember } from "../../../../components/group-balances";
import { normalizeGroupIconKey } from "../../../../components/group-icon";
import { GroupSummaryHeader } from "../../../../components/group-summary-header";
import { SwipeableGroupMember } from "../../../../components/swipeable-group-member";
import {
  ErrorState,
  ListRow,
  LoadingState,
  RowDivider,
  Screen,
  Section,
} from "../../../../components/ui";
import { shareInvite } from "../../../../lib/share-invite";
import { normalizeGroupColor } from "../../../../lib/group-colors";
import { currencySymbolWithCode } from "../../../../lib/money-display";
import { api } from "../../../../lib/trpc";
import { APP_URL } from "../../../../lib/env";

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const me = api.profile.me.useQuery();
  const utils = api.useUtils();
  const group = detail.data?.group;
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [expandedUserIds, setExpandedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  useEffect(() => {
    if (!group) return;
    setSimplifyDebts(group.simplifyDebts);
  }, [group?.id, group?.simplifyDebts, group?.version]);
  const updateSimplification = api.groups.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.detail.invalidate({ groupId: id }),
        utils.groups.balances.invalidate({ groupId: id }),
        utils.groups.list.invalidate(),
      ]);
    },
    onError() {
      setSimplifyDebts(group?.simplifyDebts ?? true);
    },
  });
  const removeMember = api.groups.removeMember.useMutation({
    async onSuccess() {
      await Promise.all([
        detail.refetch(),
        utils.groups.balances.invalidate({ groupId: id }),
      ]);
    },
  });
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) => void shareInvite(invite.url),
  });
  const leave = api.groups.leave.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  const archive = api.groups.archive.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  const deleteGroup = api.groups.delete.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  if (detail.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || !group) {
    return (
      <Screen>
        <ErrorState
          message={detail.error?.message ?? "Unable to load this group."}
          onRetry={() => void detail.refetch()}
        />
      </Screen>
    );
  }

  const balanceMembers = [...detail.data.balanceMembers].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    }),
  );
  const viewerUserId =
    balanceMembers.find((member) => member.isViewer)?.userId ??
    me.data?.userId ??
    "";
  function requestMemberRemoval(member: GroupBalanceMember) {
    const hasOpenBalance =
      BigInt(member.owes.minor) > 0n || BigInt(member.lent.minor) > 0n;
    if (hasOpenBalance) {
      Alert.alert(
        `Settle with ${member.displayName} first`,
        "A member can only be removed after their group balance reaches zero.",
        [{ text: "OK" }],
      );
      return;
    }
    Alert.alert(
      `Remove ${member.displayName}?`,
      "They can rejoin later with a new invitation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeMember.mutate({
              groupId: id,
              userId: member.userId,
            }),
        },
      ],
    );
  }

  return (
    <>
      <Screen>
        <GroupSummaryHeader
          iconKey={normalizeGroupIconKey(group.iconKey)}
          name={group.name}
          colorKey={group.id}
          color={group.color}
          imageUrl={group.imageUrl}
          lines={[
            {
              key: "currency",
              label: currencySymbolWithCode(group.currency as CurrencyCode),
              text: currencySymbolWithCode(group.currency as CurrencyCode),
              tone: "muted",
            },
          ]}
          onEdit={() => router.push(`/groups/${group.id}/edit` as Href)}
        />
        <Section
          title="Balances"
          footer="When enabled, everyone’s net group balance is combined into the smallest repayment plan instead of preserving who originally paid for whom."
        >
          <ListRow
            title="Simplify debts"
            trailing={
              <Switch
                accessibilityLabel="Simplify debts"
                style={{ alignSelf: "center" }}
                disabled={updateSimplification.isPending}
                value={simplifyDebts}
                onValueChange={(nextValue) => {
                  setSimplifyDebts(nextValue);
                  updateSimplification.mutate({
                    groupId: id,
                    expectedVersion: group.version,
                    name: group.name,
                    iconKey: normalizeGroupIconKey(group.iconKey),
                    color: normalizeGroupColor(group.color, group.id),
                    currency: group.currency as CurrencyCode,
                    simplifyDebts: nextValue,
                  });
                }}
              />
            }
          />
        </Section>
        <Section
          title="Members & balances"
          footer="Tap a member for details. Swipe left to remove a member after their balance is settled."
        >
          <ListRow
            title={
              createInvite.isPending ? "Creating invitation…" : "Invite people"
            }
            titleColor={
              process.env.EXPO_OS === "ios"
                ? PlatformColor("systemBlue")
                : "#007AFF"
            }
            subtitle="Share a reusable link valid for 7 days"
            showsDisclosureIndicator
            onPress={() =>
              createInvite.mutate({ kind: "group", groupId: id })
            }
          />
          {balanceMembers.map((member) => (
            <View key={member.userId}>
              <RowDivider />
              <SwipeableGroupMember
                member={member}
                viewerUserId={viewerUserId}
                expanded={expandedUserIds.has(member.userId)}
                removalPending={removeMember.isPending}
                onToggle={() =>
                  setExpandedUserIds((current) => {
                    const next = new Set(current);
                    if (next.has(member.userId)) next.delete(member.userId);
                    else next.add(member.userId);
                    return next;
                  })
                }
                onRemove={() => requestMemberRemoval(member)}
              />
            </View>
          ))}
        </Section>
        <Section title="Group actions">
        <ListRow
          title="Report this group"
          subtitle="Report content or abusive behavior"
          showsDisclosureIndicator={false}
          onPress={() =>
            void Linking.openURL(
              `${APP_URL}/report?type=group&id=${encodeURIComponent(group.id)}`,
            )
          }
        />
        <RowDivider inset={16} />
        <ListRow
          title="Leave group"
          destructive
          showsDisclosureIndicator={false}
          onPress={() =>
            Alert.alert("Leave group?", "Your group balance must be zero.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Leave",
                style: "destructive",
                onPress: () => leave.mutate({ groupId: id }),
              },
            ])
          }
        />
          <>
            <RowDivider inset={16} />
            <ListRow
              title="Archive group"
              destructive
              showsDisclosureIndicator={false}
              onPress={() =>
                Alert.alert(
                  "Archive group?",
                  "The group will be removed from the active list.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Archive",
                      style: "destructive",
                      onPress: () =>
                        archive.mutate({
                          groupId: id,
                          expectedVersion: group.version,
                        }),
                    },
                  ],
                )
              }
            />
            <RowDivider inset={16} />
            <ListRow
              title="Delete group permanently"
              destructive
              showsDisclosureIndicator={false}
              onPress={() =>
                Alert.alert(
                  "Delete group permanently?",
                  "The group and all of its expense history will be erased. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        deleteGroup.mutate({
                          groupId: id,
                          expectedVersion: group!.version,
                        }),
                    },
                  ],
                )
              }
            />
          </>
        </Section>
        {updateSimplification.error ? (
          <ErrorState message={updateSimplification.error.message} />
        ) : null}
        {removeMember.error ? (
          <ErrorState message={removeMember.error.message} />
        ) : null}
        {leave.error ? <ErrorState message={leave.error.message} /> : null}
        {archive.error ? <ErrorState message={archive.error.message} /> : null}
        {createInvite.error ? (
          <ErrorState message={createInvite.error.message} />
        ) : null}
        {deleteGroup.error ? (
          <ErrorState message={deleteGroup.error.message} />
        ) : null}
      </Screen>
    </>
  );
}
