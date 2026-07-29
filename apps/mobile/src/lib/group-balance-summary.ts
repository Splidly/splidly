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
