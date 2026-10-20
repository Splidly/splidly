import type { Money } from "@splidly/shared";

export type ActivityFriendRowProps = {
  name: string;
  colorKey: string;
  avatarUrl?: string | null | undefined;
  subtitle: string;
  balance?: Money | undefined;
  additionalBalances: number;
  onPress: () => void;
};
