import { useListAction } from "../../../../lib/use-list-action";
import type { CurrencyCode } from "@splidly/shared";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Switch, View, useColorScheme } from "react-native";
import type { GroupBalanceMember } from "../../../../components/group-balances";
import type { ActivityListRow, ActivityListSection, NativeSettingsRow } from "../../../../components/native-activity-list.types";
import { memberBalanceRows } from "../../../../components/member-balance-list";
import { groupIconImage, normalizeGroupIconKey } from "../../../../components/group-icon";
import { GroupSummaryHeader } from "../../../../components/group-summary-header";
import {
  ActivityMemberInvite,
} from "../../../../components/activity-group-member-row";
import {
  ErrorState,
  ListRow,
  LoadingState,
  RowDivider,
  Screen,
  Section,
  SectionFooter,
} from "../../../../components/ui";
import { shareInvite } from "../../../../lib/share-invite";
import { groupIconColorsFor, normalizeGroupColor } from "../../../../lib/group-colors";
import { currencySymbolWithCode } from "../../../../lib/money-display";
import { api } from "../../../../lib/trpc";
import { APP_URL } from "../../../../lib/env";
import { useNavigationPressGuard } from "../../../../lib/use-navigation-press-guard";

function nativeSettingRow(
  key: string,
  title: string,
  settings: Partial<NativeSettingsRow> = {},
  onPress?: () => void,
): ActivityListRow {
  return {
    key, nativeContent: true, content: null,
    ...(onPress && settings.enabled !== false ? { onPress } : {}),
    settings: { title, symbol: "", identity: false, enabled: true,
      destructive: false, showsDisclosure: false, ...settings },
  };
}

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const me = api.profile.me.useQuery();
  const utils = api.useUtils();
  const confirm = useListAction();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const canOpenEdit = useNavigationPressGuard();
  const group = detail.data?.group;
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [expandedUserIds, setExpandedUserIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!group) return;
    setSimplifyDebts(group.simplifyDebts);
  }, [group?.id, group?.simplifyDebts, group?.version]);
  useEffect(() => {
    if (!detail.data) return;
    setNotificationsEnabled(detail.data.notificationsEnabled);
  }, [detail.data?.notificationsEnabled, group?.id]);
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
  const updateNotifications = api.groups.setNotificationPreference.useMutation({
    async onSuccess() {
      await utils.groups.detail.invalidate({ groupId: id });
    },
    onError() {
      setNotificationsEnabled(detail.data?.notificationsEnabled ?? true);
    },
  });
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) => void shareInvite(invite.url),
  });
  const leave = api.groups.leave.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.archivedCount.invalidate(),
      ]);
      router.dismissTo("/groups");
    },
  });
  const archive = api.groups.archive.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.archivedCount.invalidate(),
      ]);
      router.dismissTo("/groups");
    },
  });
  const deleteGroup = api.groups.delete.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.archivedCount.invalidate(),
      ]);
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
  function requestMemberRemoval(member: GroupBalanceMember): Promise<boolean> {
    if (BigInt(member.owes.minor) > 0n || BigInt(member.lent.minor) > 0n) {
      Alert.alert(
        `Settle with ${member.displayName} first`,
        "A member can only be removed after their group balance reaches zero.",
      );
      return Promise.resolve(false);
    }
    return confirm({
      title: `Remove ${member.displayName}?`,
      message: "They can rejoin later with a new invitation.",
      label: "Remove",
      perform: () =>
        removeMember.mutateAsync({ groupId: id, userId: member.userId }),
    });
  }

  const viewerUserId = balanceMembers.find(member => member.isViewer)?.userId ?? me.data?.userId ?? "";
  function toggleMember(userId: string) {
    setExpandedUserIds(current => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  const balanceFooter = "When enabled, everyone’s net group balance is combined into the smallest repayment plan instead of preserving who originally paid for whom.";
  const notificationsFooter = me.data?.notificationsEnabled === false
    ? "Notifications are disabled for the whole app. You can enable them in Profile > Notifications."
    : "This setting only affects notifications from this group.";
  const memberFooter = "Tap a member to see who owes whom. Swipe left to remove a settled member.";
  const notificationsDisabled = updateNotifications.isPending || me.data?.notificationsEnabled === false;
  const editGroup = () => {
    if (canOpenEdit()) router.push(`/groups/${group.id}/edit` as Href);
  };
  function changeSimplification(nextValue: boolean) {
    if (updateSimplification.isPending) return;
    setSimplifyDebts(nextValue);
    updateSimplification.mutate({
      groupId: id, expectedVersion: group!.version, name: group!.name,
      iconKey: normalizeGroupIconKey(group!.iconKey),
      color: normalizeGroupColor(group!.color, group!.id),
      currency: group!.currency as CurrencyCode, simplifyDebts: nextValue,
    });
  }
  function changeNotifications(enabled: boolean) {
    if (notificationsDisabled) return;
    setNotificationsEnabled(enabled);
    updateNotifications.mutate({ groupId: id, enabled });
  }
  const actions = [
    { key: "report", title: "Report this group", subtitle: "Report content or abusive behavior", symbol: "flag",
      onPress: () => void Linking.openURL(`${APP_URL}/report?type=group&id=${encodeURIComponent(group.id)}`) },
    { key: "leave", title: "Leave group", destructive: true, disabled: leave.isPending,
      onPress: () => Alert.alert("Leave group?", "Your group balance must be zero.", [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => leave.mutate({ groupId: id }) },
      ]) },
    { key: "archive", title: "Archive group", destructive: true, disabled: archive.isPending,
      onPress: () => void confirm({ confirmation: false, title: "Archive group?", message: "", label: "Archive",
        perform: () => archive.mutateAsync({ groupId: id, expectedVersion: group.version }) }) },
    { key: "delete", title: "Delete group permanently", destructive: true, disabled: deleteGroup.isPending,
      onPress: () => Alert.alert("Delete group permanently?", "The group and all of its expense history will be erased. This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteGroup.mutate({ groupId: id, expectedVersion: group.version }) },
      ]) },
  ];
  const errors = [updateSimplification.error, updateNotifications.error, removeMember.error,
    leave.error, archive.error, createInvite.error, deleteGroup.error].filter(error => error != null);
  const membersSection: ActivityListSection = {
    key: "members", label: process.env.EXPO_OS === "ios" ? `Members (${balanceMembers.length})` : "Members & balances", nativeHeader: true,
    ...(process.env.EXPO_OS === "ios" ? { nativeFooter: "Swipe to remove settled members." } : {}),
    data: [
      process.env.EXPO_OS === "ios"
        ? nativeSettingRow("invite", createInvite.isPending ? "Creating invitation…" : "Invite people", {
            subtitle: "Link valid for 7 days", symbol: "person.badge.plus",
            enabled: !createInvite.isPending, showsDisclosure: true,
          }, () => createInvite.mutate({ kind: "group", groupId: id }))
        : { key: "invite", nativeContent: true, content: <ActivityMemberInvite pending={createInvite.isPending}
            onPress={() => createInvite.mutate({ kind: "group", groupId: id })} /> },
      ...balanceMembers.flatMap(member => {
        const [row, ...children] = memberBalanceRows(member, () => toggleMember(member.userId), viewerUserId, expandedUserIds.has(member.userId), scheme);
        return [{ ...row!, actionTitle: "Remove", actionIcon: "person.badge.minus",
          deleteLabel: `Remove ${member.displayName}`, deletionDisabled: removeMember.isPending,
          ...(!member.isViewer ? { onDelete: () => requestMemberRemoval(member) } : {}),
        }, ...children];
      }),
    ],
  };

  if (process.env.EXPO_OS === "ios") {
    const icon = groupIconImage(normalizeGroupIconKey(group.iconKey));
    const colors = groupIconColorsFor(group.color, group.id, scheme);
    return <Screen activityList={{ sections: [
      { key: "group", label: "", nativeHeader: true, data: [
        nativeSettingRow("edit-group", group.name, {
          subtitle: currencySymbolWithCode(group.currency as CurrencyCode),
          symbol: typeof icon === "string" ? icon : "person.3.fill", identity: true, showsDisclosure: true,
          avatarFallback: { initials: "", rounded: true, backgroundColor: colors.background, foregroundColor: colors.foreground },
          ...(group.imageUrl ? { imageUri: group.imageUrl } : {}),
        }, editGroup),
      ] },
      { key: "preferences", label: "Preferences", nativeHeader: true,
        nativeFooter: [
          "Simplify debts reduces repayments without changing anyone’s net balance.",
          ...(me.data?.notificationsEnabled === false ? ["Notifications are off in Profile > Notifications."] : []),
        ].join("\n\n"), data: [
        nativeSettingRow("group-notifications", "Notifications", {
          toggleValue: notificationsEnabled,
          enabled: !notificationsDisabled,
        }, () => changeNotifications(!notificationsEnabled)),
        nativeSettingRow("simplify-debts", "Simplify debts", {
          toggleValue: simplifyDebts, enabled: !updateSimplification.isPending,
        }, () => changeSimplification(!simplifyDebts)),
      ] },
      membersSection,
      { key: "actions", label: "Group actions", nativeHeader: true, data: actions.map(action =>
        nativeSettingRow(action.key, action.title, {
          symbol: action.symbol ?? "",
          destructive: action.destructive ?? false, enabled: !action.disabled,
        }, action.onPress)),
      },
      ...(errors.length ? [{ key: "errors", label: "", nativeHeader: true,
        data: errors.map((error, index) => nativeSettingRow(`error:${index}`, error.message, {
          destructive: true, enabled: false, symbol: "exclamationmark.triangle",
        })),
      }] : []),
    ] }} />;
  }

  return <Screen activityList={{ sections: [membersSection], footer: <>
    <SectionFooter>{memberFooter}</SectionFooter>
    <Section title="Group actions">
      {actions.map((action, index) => <View key={action.key}>
        {index > 0 ? <RowDivider inset={16} /> : null}
        <ListRow title={action.title} {...(action.subtitle ? { subtitle: action.subtitle } : {})}
          destructive={action.destructive ?? false}
          showsDisclosureIndicator={false} {...(!action.disabled ? { onPress: action.onPress } : {})} />
      </View>)}
    </Section>
    {errors.map((error, index) => <ErrorState key={index} message={error.message} />)}
  </> }}>
    <GroupSummaryHeader iconKey={normalizeGroupIconKey(group.iconKey)} name={group.name}
      colorKey={group.id} color={group.color} imageUrl={group.imageUrl}
      lines={[{ key: "currency", label: currencySymbolWithCode(group.currency as CurrencyCode),
        text: currencySymbolWithCode(group.currency as CurrencyCode), tone: "muted" }]} onEdit={editGroup} />
    <Section title="Balances" footer={balanceFooter}>
      <ListRow title="Simplify debts" trailing={<Switch accessibilityLabel="Simplify debts"
        style={{ alignSelf: "center" }} disabled={updateSimplification.isPending}
        value={simplifyDebts} onValueChange={changeSimplification} />} />
    </Section>
    <Section title="Notifications" footer={notificationsFooter}>
      <ListRow title="Group notifications" subtitle="Expense changes and activity summaries"
        trailing={<Switch accessibilityLabel={`Notifications for ${group.name}`} style={{ alignSelf: "center" }}
          disabled={notificationsDisabled} value={notificationsEnabled} onValueChange={changeNotifications} />} />
    </Section>
  </Screen>;
}
