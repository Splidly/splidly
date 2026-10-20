import type { GroupIconKey, Money } from "@splidly/shared";
import type { GroupMemberBalance } from "../lib/group-balance-summary";
export type ActivityGroupRowProps = {
  id: string;
  name: string;
  iconKey: GroupIconKey;
  color?: string | null | undefined;
  imageUrl?: string | null | undefined;
  balance: Money;
  memberBalances: GroupMemberBalance[];
  onPress: () => void;
};
