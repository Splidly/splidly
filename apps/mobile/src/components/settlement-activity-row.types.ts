import type { Money } from "@splidly/shared";

type SettlementPerson = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isViewer: boolean;
};

export type SettlementActivityRowProps = {
  settlement: {
    from: SettlementPerson;
    to: SettlementPerson;
    amount: Money;
  };
  onPress?: () => void;
};
