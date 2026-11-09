import type { CurrencyCode, Money } from "@splidly/shared";
import type { ActivityPreview } from "../components/native-activity-list.types";
import type { InvolvementKind } from "../components/expense-list-involvement";
import { groupIconImage, normalizeGroupIconKey } from "../components/group-icon";
import { groupListBalanceLines, type GroupMemberBalance } from "./group-balance-summary";
import { expensePaymentSummary } from "./expense-activity";
import { formatMoney } from "./money-display";
import type { AvatarColorScheme } from "./avatar-colors";
import { nativeUserAvatar } from "../components/native-avatar";

function balanceSummary(balance: Money) {
  const minor = BigInt(balance.minor);
  return {
    headline: formatMoney(minor < 0n ? -minor : minor, balance.currency),
    caption: minor < 0n ? "You owe" : minor > 0n ? "You are owed" : "All settled up",
    tone: minor < 0n ? "negative" as const : minor > 0n ? "positive" as const : "neutral" as const,
  };
}

export function groupPreview(group: {
  name: string;
  iconKey: unknown;
  imageUrl?: string | null;
  balance: Money;
  memberBalances: GroupMemberBalance[];
}): ActivityPreview {
  const lines = groupListBalanceLines(group.memberBalances);
  const icon = groupIconImage(normalizeGroupIconKey(group.iconKey));
  const summary = balanceSummary(group.balance);
  return {
    title: group.name,
    subtitle: "Group",
    symbol: typeof icon === "string" ? icon : "person.3.fill",
    imageUrl: group.imageUrl ?? null,
    ...summary,
    // A zero net balance can still have debts in both directions.
    caption: BigInt(group.balance.minor) === 0n && lines.length > 0 ? "Net balance" : summary.caption,
    debts: lines.slice(0, 4).map((line) => ({ label: line.label, value: line.amount ?? "", tone: line.tone === "muted" ? "neutral" as const : line.tone })),
    ...(lines.length > 4 ? { debtNote: `${lines.length - 4} more open balances in group details` } : {}),
    details: [
      { label: "Currency", value: group.balance.currency },
    ],
  };
}

export function friendPreview(
  name: string,
  imageUrl: string | null | undefined,
  balances: { contextType: string; viewerAmount: Money; canonicalAmount: Money; counterpartyAmount: Money }[],
  avatar?: { userId: string; scheme: AvatarColorScheme },
): ActivityPreview {
  return {
    title: name,
    subtitle: "Friend",
    avatarFallback: nativeUserAvatar(name, avatar?.userId ?? name, avatar?.scheme ?? "light"),
    symbol: "person.fill",
    imageUrl: imageUrl ?? null,
    headline: balances.length === 0 ? "All settled up" : `${balances.length} open ${balances.length === 1 ? "ledger" : "ledgers"}`,
    caption: balances.length === 0 ? "No outstanding balances" : "Your shared balances",
    debts: balances.slice(0, 4).map((balance) => {
        const amount = BigInt(balance.viewerAmount.minor) !== 0n
          ? balance.viewerAmount
          : BigInt(balance.canonicalAmount.minor) !== 0n
            ? balance.canonicalAmount
            : balance.counterpartyAmount;
        const summary = balanceSummary(amount);
        return {
          label: BigInt(amount.minor) < 0n ? `You owe ${name}` : `${name} owes you`,
          subtitle: balance.contextType === "group" ? "Group ledger" : "Direct ledger",
          value: summary.headline,
          tone: summary.tone,
        };
      }),
    ...(balances.length > 4 ? { debtNote: `${balances.length - 4} more open ledgers in friend details` } : {}),
    details: [],
  };
}

export function expensePreview(expense: {
  description: string;
  sourceAmountMinor: string | bigint;
  sourceCurrency: string;
  occurredAt: Date | string;
  notes?: string | null;
  payers?: { displayName: string; isViewer: boolean }[];
  paymentTotal?: Money;
  viewerInvolvement?: { kind: InvolvementKind; amount: Money };
  previewDebts?: {
    from: { displayName: string; isViewer: boolean };
    to: { displayName: string; isViewer: boolean };
    amount: Money;
  }[];
}, ledger: string, payer?: string): ActivityPreview {
  const involvement = expense.viewerInvolvement;
  const previewDebts = expense.previewDebts ?? [];
  const labels: Record<InvolvementKind, string> = {
    lent: "You lent", borrowed: "You owe", paid: "You paid",
    received: "You received", settled: "Settled", none: "Not involved",
  };
  return {
    title: expense.description,
    subtitle: ledger,
    symbol: "receipt",
    headline: formatMoney(expense.sourceAmountMinor, expense.sourceCurrency as CurrencyCode),
    caption: "Total expense",
    debts: previewDebts.slice(0, 4).map((debt) => ({
      label: debt.from.isViewer
        ? `You owe ${debt.to.displayName}`
        : debt.to.isViewer
          ? `${debt.from.displayName} owes you`
          : `${debt.from.displayName} owes ${debt.to.displayName}`,
      value: formatMoney(debt.amount.minor, debt.amount.currency),
      tone: debt.from.isViewer ? "negative" as const : debt.to.isViewer ? "positive" as const : "neutral" as const,
    })),
    ...(previewDebts.length > 0 ? {
      debtNote: `${previewDebts.length > 4 ? `${previewDebts.length - 4} more allocations. Open the expense for the full split. ` : ""}Original allocation. Later payments are reflected in current balances.`,
    } : {}),
    details: [
      { label: "Date", value: new Date(expense.occurredAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) },
      ...(expense.payers && expense.paymentTotal
        ? [{ label: "Payment", value: expensePaymentSummary(expense.payers, expense.paymentTotal) }]
        : payer ? [{ label: "Paid by", value: payer }] : []),
      ...(involvement ? [{
        label: labels[involvement.kind],
        value: involvement.kind === "none" ? "No share" : formatMoney(involvement.amount.minor, involvement.amount.currency),
        tone: involvement.kind === "borrowed" ? "negative" as const : involvement.kind === "lent" ? "positive" as const : "neutral" as const,
      }] : []),
      ...(expense.notes ? [{ label: "Note", value: expense.notes.length > 120 ? `${expense.notes.slice(0, 117)}...` : expense.notes }] : []),
    ],
  };
}

export function settlementPreview(settlement: {
  from: { displayName: string; isViewer: boolean };
  to: { displayName: string; isViewer: boolean };
  amount: Money;
  occurredAt: Date | string;
  notes?: string | null;
}, ledger: string): ActivityPreview {
  return {
    title: "Payment",
    subtitle: ledger,
    symbol: "arrow.left.arrow.right",
    headline: formatMoney(settlement.amount.minor, settlement.amount.currency),
    caption: settlement.from.isViewer ? "You paid" : settlement.to.isViewer ? "You received" : "Payment recorded",
    tone: settlement.from.isViewer ? "negative" : settlement.to.isViewer ? "positive" : "neutral",
    details: [
      { label: "Paid by", value: settlement.from.isViewer ? "You" : settlement.from.displayName },
      { label: "Paid to", value: settlement.to.isViewer ? "You" : settlement.to.displayName },
      { label: "Date", value: new Date(settlement.occurredAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) },
      ...(settlement.notes ? [{ label: "Note", value: settlement.notes.length > 120 ? `${settlement.notes.slice(0, 117)}...` : settlement.notes }] : []),
    ],
  };
}
