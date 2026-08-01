import type { CurrencyCode, Money } from "@splidly/shared";
import { formatExpenseActivityDate } from "./expense-activity";
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

export function settlementActivitySubtitle(input: {
  occurredAt: Date | string;
  from: SettlementPerson;
  to: SettlementPerson;
  amount: Money;
  locale?: string | undefined;
}) {
  return `${formatExpenseActivityDate(
    input.occurredAt,
    input.locale,
  )} · ${settlementPaymentSummary(input)}`;
}
