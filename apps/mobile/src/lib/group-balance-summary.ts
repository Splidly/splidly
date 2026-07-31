import type { CurrencyCode, Money } from "@splidly/shared";
import {
  currencySymbol,
  formatConvertedMoney,
} from "./money-display";

export type GroupMemberBalance = {
  userId: string;
  displayName: string;
  balance: Money;
};

export type GroupBalanceLine = {
  key: string;
  label: string;
  compactLabel?: string;
  text: string;
  amount?: string;
  tone: "positive" | "negative" | "muted";
};

export type GroupListSummaryLine = GroupBalanceLine;

function abbreviatedName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase())
    .filter(Boolean)
    .join(".");
  return initials ? `${initials}.` : name;
}

function memberAmounts(
  balances: GroupMemberBalance[],
  direction: "positive" | "negative",
) {
  return balances
    .filter((item) => {
      const minor = BigInt(item.balance.minor);
      return direction === "positive" ? minor > 0n : minor < 0n;
    })
    .map((item) => {
      const minor = BigInt(item.balance.minor);
      return {
        key: `${direction}-${item.userId}`,
        name: item.displayName,
        abbreviatedName: abbreviatedName(item.displayName),
        amount: formatConvertedMoney(
          minor < 0n ? -minor : minor,
          item.balance.currency as CurrencyCode,
        ),
      };
    });
}

export function groupBalanceLines(
  balances: GroupMemberBalance[],
  memberCount: number,
  currency: string,
): GroupBalanceLine[] {
  const lines: GroupBalanceLine[] = [
    ...memberAmounts(balances, "negative").map((item) => {
      const label = `You owe ${item.name}`;
      return {
        key: item.key,
        label,
        compactLabel: `You owe ${item.abbreviatedName}`,
        text: `${label} ${item.amount}`,
        amount: item.amount,
        tone: "negative" as const,
      };
    }),
    ...memberAmounts(balances, "positive").map((item) => {
      const label = `${item.name} owes you`;
      return {
        key: item.key,
        label,
        compactLabel: `${item.abbreviatedName} owes you`,
        text: `${label} ${item.amount}`,
        amount: item.amount,
        tone: "positive" as const,
      };
    }),
  ];
  if (lines.length === 0) {
    const text = `All settled up · ${memberCount} ${
      memberCount === 1 ? "member" : "members"
    } · ${currencySymbol(currency as CurrencyCode)}`;
    lines.push({
      key: "settled",
      label: text,
      text,
      tone: "muted",
    });
  }
  return lines;
}

export function groupListBalanceLines(
  balances: GroupMemberBalance[],
): GroupBalanceLine[] {
  return [
    ...memberAmounts(balances, "negative").map((item) => {
      const label = `You owe ${item.name}`;
      return {
        key: item.key,
        label,
        compactLabel: `You owe ${item.abbreviatedName}`,
        text: `${label} ${item.amount}`,
        amount: item.amount,
        tone: "negative" as const,
      };
    }),
    ...memberAmounts(balances, "positive").map((item) => {
      const label = `${item.name} owes you`;
      return {
        key: item.key,
        label,
        compactLabel: `${item.abbreviatedName} owes you`,
        text: `${label} ${item.amount}`,
        amount: item.amount,
        tone: "positive" as const,
      };
    }),
  ];
}

export function overallGroupBalanceLines(
  groups: { memberBalances: GroupMemberBalance[] }[],
): GroupListSummaryLine[] {
  const totals = new Map<
    string,
    { owesMinor: bigint; owedMinor: bigint }
  >();
  for (const group of groups) {
    for (const member of group.memberBalances) {
      const minor = BigInt(member.balance.minor);
      const total = totals.get(member.balance.currency) ?? {
        owesMinor: 0n,
        owedMinor: 0n,
      };
      if (minor < 0n) total.owesMinor += -minor;
      if (minor > 0n) total.owedMinor += minor;
      totals.set(member.balance.currency, total);
    }
  }

  const lines: GroupListSummaryLine[] = [];
  for (const [currency, total] of [...totals].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (total.owesMinor > 0n) {
      const amount = formatConvertedMoney(
        total.owesMinor,
        currency as CurrencyCode,
      );
      lines.push({
        key: `owes-${currency}`,
        label: "You owe",
        text: `You owe ${amount}`,
        amount,
        tone: "negative",
      });
    }
    if (total.owedMinor > 0n) {
      const amount = formatConvertedMoney(
        total.owedMinor,
        currency as CurrencyCode,
      );
      lines.push({
        key: `owed-${currency}`,
        label: "You are owed",
        text: `You are owed ${amount}`,
        amount,
        tone: "positive",
      });
    }
  }

  return lines.length > 0
    ? lines
    : [
        {
          key: "settled",
          label: "All groups are settled up",
          text: "All groups are settled up",
          tone: "muted",
        },
      ];
}
