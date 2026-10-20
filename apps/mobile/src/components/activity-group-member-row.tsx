import { View } from "react-native";
import { GroupBalanceMemberRow, MemberRelationships } from "./group-balances";
import { ListRow } from "./ui";
import type {
  ActivityGroupMemberRowProps,
  ActivityMemberInviteProps,
} from "./activity-group-member-row.types";
export function ActivityGroupMemberRow({
  member,
  viewerUserId,
  expanded,
  onToggle,
}: ActivityGroupMemberRowProps) {
  return (
    <View>
      <GroupBalanceMemberRow
        member={member}
        expanded={expanded}
        onPress={onToggle}
      />
      {expanded ? (
        <MemberRelationships member={member} viewerUserId={viewerUserId} />
      ) : null}
    </View>
  );
}
export function ActivityMemberInvite({
  pending,
  onPress,
}: ActivityMemberInviteProps) {
  return (
    <ListRow
      title={pending ? "Creating invitation…" : "Invite people"}
      titleColor="#007AFF"
      subtitle="Share a reusable link valid for 7 days"
      showsDisclosureIndicator
      onPress={onPress}
    />
  );
}
