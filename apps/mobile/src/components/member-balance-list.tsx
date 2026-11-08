import type { AvatarColorScheme } from "../lib/avatar-colors";
import { nativeUserAvatar } from "./native-avatar";
import { View } from "react-native";
import { formatMoney } from "../lib/money-display";
import { ListRow } from "./ui";
import { themeForScheme } from "../theme";
import { GroupBalanceMemberRow, memberBalanceBadges, type GroupBalanceMember } from "./group-balances";
import type { ActivityListRow, NativeSettingsRow } from "./native-activity-list.types";

function memberDetails(member: GroupBalanceMember, viewerUserId: string) {
  return member.relationships.length ? member.relationships.map(relationship => {
    const name = relationship.counterpartyId === viewerUserId ? "you" : relationship.counterpartyDisplayName;
    const title = relationship.kind === "owes"
      ? `${member.isViewer ? "You owe" : "Owes"} ${name}`
      : `${name === "you" ? "You owe" : `${name} owes`} ${member.isViewer ? "you" : member.displayName}`;
    return {
      key: `${member.userId}:${relationship.kind}:${relationship.counterpartyId}`,
      title,
      value: formatMoney(relationship.amount.minor, relationship.amount.currency),
      tone: relationship.kind === "owes" ? "negative" as const : "positive" as const,
    };
  }) : [{ key: `${member.userId}:settled`, title: "No outstanding balances.", value: "", tone: "muted" as const }];
}

export function memberBalanceRow(member: GroupBalanceMember, onToggle: () => void, viewerUserId = "", expanded = false, scheme: AvatarColorScheme = "light"): ActivityListRow {
  const owes = BigInt(member.owes.minor) > 0n;
  const lent = BigInt(member.lent.minor) > 0n;
  const title = member.isViewer ? `${member.displayName} (You)` : member.displayName;
  const value = [
    owes ? `Owes ${formatMoney(member.owes.minor, member.owes.currency)}` : null,
    lent ? `Lent ${formatMoney(member.lent.minor, member.lent.currency)}` : null,
  ].filter(Boolean).join("\n") || "Settled up";
  return {
    key: member.userId,
    nativeContent: true,
    ...(process.env.EXPO_OS === "ios" ? {
      settings: {
        title, value, symbol: "", identity: false,
        balances: memberBalanceBadges(member, themeForScheme(scheme)).map(balance => ({
          label: balance.label, value: balance.amount ? formatMoney(balance.amount.minor, balance.amount.currency) : "", color: balance.color,
        })),
        avatarFallback: nativeUserAvatar(member.displayName, member.userId, scheme),
        avatar: true, enabled: true, destructive: false, showsDisclosure: false,
        disclosure: true, details: memberDetails(member, viewerUserId).map(({ title, value, tone }) => ({ title, value, tone })),
        valueTone: owes && !lent ? "negative" : lent && !owes ? "positive" : "muted",
        ...(member.avatarUrl ? { imageUri: member.avatarUrl } : {}),
      } satisfies NativeSettingsRow,
    } : {}),
    content: process.env.EXPO_OS === "ios" ? null : <GroupBalanceMemberRow member={member} expanded={expanded} onPress={onToggle} />,
  };
}

export function memberBalanceRows(member: GroupBalanceMember, onToggle: () => void, viewerUserId: string, expanded: boolean, scheme: AvatarColorScheme = "light"): ActivityListRow[] {
  const row = memberBalanceRow(member, onToggle, viewerUserId, expanded, scheme);
  if (process.env.EXPO_OS === "ios" || !expanded) return [row];
  return [row, ...memberDetails(member, viewerUserId).map(detail => ({
    key: detail.key,
    content: <View style={{ paddingLeft: 32 }}><ListRow title={detail.title}
      {...(detail.value ? { value: detail.value } : {})} valueTone={detail.tone} /></View>,
  }))];
}
