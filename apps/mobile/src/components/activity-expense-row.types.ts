import type { Money } from "@splidly/shared";
import type { InvolvementKind } from "./expense-list-involvement";

export type ActivityExpenseRowProps = {
  title: string;
  subtitle?: string;
  iconKey: unknown;
  useNameFallback: boolean;
  involvement?: { kind: InvolvementKind; amount: Money };
  value?: string;
  onPress: () => void;
};
