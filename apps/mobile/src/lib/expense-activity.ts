import type { CurrencyCode, Money } from "@splidly/shared";
import { formatMoney } from "./money-display";

type ActivityPayer = {
  displayName: string;
  isViewer: boolean;
};

export function formatExpenseActivityDate(
  value: Date | string,
  locale?: string | undefined,
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(value));
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts
    .find((part) => part.type === "month")
    ?.value.replace(/\.$/, "");
  return day && month
    ? `${day} ${month}`
    : new Date(value).toLocaleDateString(locale);
}

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

export function expenseActivitySubtitle(input: {
  occurredAt: Date | string;
  payers: readonly ActivityPayer[];
  paymentTotal: Money;
  locale?: string | undefined;
}): string {
  return `${formatExpenseActivityDate(
    input.occurredAt,
    input.locale,
  )} · ${expensePaymentSummary(input.payers, input.paymentTotal)}`;
}
