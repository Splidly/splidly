import type { GroupBalanceMember } from "./group-balances";
export type ActivityGroupMemberRowProps = {
  member: GroupBalanceMember;
  viewerUserId: string;
  expanded: boolean;
  onToggle: () => void;
};
export type ActivityMemberInviteProps = {
  pending: boolean;
  onPress: () => void;
};
