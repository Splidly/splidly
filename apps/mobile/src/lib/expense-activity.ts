import type { CurrencyCode, Money } from "@splidly/shared";
import { formatMoney } from "./money-display";

type ActivityPayer = {
  displayName: string;
  isViewer: boolean;
};

export function expensePaymentSummary(
  payers: readonly ActivityPayer[],
  paymentTotal: Money,
): string {
  const names = payers.map((payer) =>
    payer.isViewer ? "You" : payer.displayName,
  );
  const payerSummary =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} + ${names[1]}`
        : `${names[0]} + ${names.length - 1} others`;
  const amount = formatMoney(
    paymentTotal.minor,
    paymentTotal.currency as CurrencyCode,
  );
  return `${payerSummary ?? "Someone"} paid ${amount}`;
}
