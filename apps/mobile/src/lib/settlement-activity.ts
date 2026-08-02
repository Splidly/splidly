import type { CurrencyCode, Money } from "@splidly/shared";
import { formatMoney } from "./money-display";

type SettlementPerson = {
  displayName: string;
  isViewer: boolean;
};

export function settlementPaymentSummary(input: {
  from: SettlementPerson;
  to: SettlementPerson;
  amount: Money;
}) {
  const fromName = input.from.isViewer ? "You" : input.from.displayName;
  const toName = input.to.isViewer ? "you" : input.to.displayName;
  const amount = formatMoney(
    input.amount.minor,
    input.amount.currency as CurrencyCode,
  );
  return `${fromName} paid ${toName} ${amount}`;
}
