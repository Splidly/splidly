export type ExpenseTransfer = {
  debtorId: string;
  creditorId: string;
  sourceAmountMinor: bigint;
};

export function allocateByUser(
  totalMinor: bigint,
  sourceAmounts: ReadonlyMap<string, bigint>,
): Map<string, bigint> {
  const entries = [...sourceAmounts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const amounts = allocateByWeights(
    totalMinor,
    entries.map(([, amount]) => amount),
  );
  return new Map(
    entries.map(([userId], index) => [
      userId,
      amounts[index] ?? 0n,
    ]),
  );
}

export function expenseTransfers(
  payments: ReadonlyMap<string, bigint>,
  shares: ReadonlyMap<string, bigint>,
): ExpenseTransfer[] {
  const paidTotal = [...payments.values()].reduce(
    (sum, amount) => sum + amount,
    0n,
  );
  const sharedTotal = [...shares.values()].reduce(
    (sum, amount) => sum + amount,
    0n,
  );
  if (paidTotal !== sharedTotal) {
    throw new Error("Payments and shares must match the expense total");
  }

  const userIds = new Set([...payments.keys(), ...shares.keys()]);
  const creditors: { userId: string; remaining: bigint }[] = [];
  const debtors: { userId: string; remaining: bigint }[] = [];
  for (const userId of userIds) {
    const net =
      (payments.get(userId) ?? 0n) - (shares.get(userId) ?? 0n);
    if (net > 0n) creditors.push({ userId, remaining: net });
    if (net < 0n) debtors.push({ userId, remaining: -net });
  }

  const transfers: ExpenseTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (
    debtorIndex < debtors.length &&
    creditorIndex < creditors.length
  ) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (!debtor || !creditor) break;
    const amount =
      debtor.remaining < creditor.remaining
        ? debtor.remaining
        : creditor.remaining;
    if (amount > 0n) {
      transfers.push({
        debtorId: debtor.userId,
        creditorId: creditor.userId,
        sourceAmountMinor: amount,
      });
    }
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0n) debtorIndex += 1;
    if (creditor.remaining === 0n) creditorIndex += 1;
  }

  if (
    debtors.some((debtor) => debtor.remaining !== 0n) ||
    creditors.some((creditor) => creditor.remaining !== 0n)
  ) {
    throw new Error("Expense allocation did not balance");
  }
  return transfers;
}
import { allocateByWeights } from "@splidly/shared";
