import { ListRow } from "./ui";
import type { ActivityMemberInviteProps } from "./activity-group-member-row.types";

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
