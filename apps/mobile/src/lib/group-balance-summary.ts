import {
  formatMinor,
  type CurrencyCode,
  type Money,
} from "@splidly/shared";

export type GroupMemberBalance = {
  userId: string;
  displayName: string;
  balance: Money;
};

export type GroupBalanceLine = {
  key: "owed" | "owes" | "settled";
  text: string;
  tone: "positive" | "negative" | "muted";
};

export type GroupListSummaryLine = {
  key: string;
  text: string;
  tone: "positive" | "negative" | "muted";
};

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
        name: item.displayName,
        amount: `${formatMinor(
          minor < 0n ? -minor : minor,
          item.balance.currency as CurrencyCode,
        )} ${item.balance.currency}`,
      };
    });
}

export function groupBalanceLines(
  balances: GroupMemberBalance[],
  memberCount: number,
  currency: string,
): GroupBalanceLine[] {
  const owed = memberAmounts(balances, "positive")
    .map((item) => `${item.name} owes you ${item.amount}`)
    .join(" · ");
  const owes = memberAmounts(balances, "negative")
    .map((item) => `You owe ${item.name} ${item.amount}`)
    .join(" · ");
  const lines: GroupBalanceLine[] = [];
  if (owes) {
    lines.push({
      key: "owes",
      text: owes,
      tone: "negative",
    });
  }
  if (owed) {
    lines.push({
      key: "owed",
      text: owed,
      tone: "positive",
    });
  }
  if (lines.length === 0) {
    lines.push({
      key: "settled",
      text: `All settled up · ${memberCount} ${
        memberCount === 1 ? "member" : "members"
      } · ${currency}`,
      tone: "muted",
    });
  }
  return lines;
}

export function groupListBalanceLines(
  balances: GroupMemberBalance[],
): GroupBalanceLine[] {
  const owes = memberAmounts(balances, "negative")
    .map((item) => `You owe ${item.name} ${item.amount}`)
    .join(" · ");
  const owed = memberAmounts(balances, "positive")
    .map((item) => `${item.name} owes you ${item.amount}`)
    .join(" · ");
  const lines: GroupBalanceLine[] = [];

  if (owes) {
    lines.push({ key: "owes", text: owes, tone: "negative" });
  }
  if (owed) {
    lines.push({ key: "owed", text: owed, tone: "positive" });
  }
  if (lines.length === 0) {
    lines.push({
      key: "settled",
      text: "All settled up",
      tone: "muted",
    });
  }

  return lines;
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
      lines.push({
        key: `owes-${currency}`,
        text: `You owe ${formatMinor(
          total.owesMinor,
          currency as CurrencyCode,
        )} ${currency}`,
        tone: "negative",
      });
    }
    if (total.owedMinor > 0n) {
      lines.push({
        key: `owed-${currency}`,
        text: `You are owed ${formatMinor(
          total.owedMinor,
          currency as CurrencyCode,
        )} ${currency}`,
        tone: "positive",
      });
    }
  }

  return lines.length > 0
    ? lines
    : [
        {
          key: "settled",
          text: "All groups are settled up",
          tone: "muted",
        },
      ];
}
