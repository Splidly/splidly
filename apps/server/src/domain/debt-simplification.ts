export type LedgerAmount = {
  debtorId: string;
  creditorId: string;
  canonicalAmountMinor: bigint;
};

export type RepaymentTransfer = {
  fromUserId: string;
  toUserId: string;
  amountMinor: bigint;
};

export type RepaymentMember = {
  userId: string;
  displayName: string;
};

export type ViewerRepaymentBalance = RepaymentMember & {
  amountMinor: bigint;
};

export type MemberRepaymentRelationship = {
  kind: "owes" | "lent";
  counterpartyId: string;
  counterpartyDisplayName: string;
  counterpartyAvatarUrl: string | null;
  amountMinor: bigint;
};

export type MemberRepaymentSummary = RepaymentMember & {
  avatarUrl: string | null;
  owesMinor: bigint;
  lentMinor: bigint;
  relationships: MemberRepaymentRelationship[];
};

function netBalances(entries: LedgerAmount[]) {
  const balances = new Map<string, bigint>();
  for (const entry of entries) {
    balances.set(
      entry.debtorId,
      (balances.get(entry.debtorId) ?? 0n) - entry.canonicalAmountMinor,
    );
    balances.set(
      entry.creditorId,
      (balances.get(entry.creditorId) ?? 0n) + entry.canonicalAmountMinor,
    );
  }
  return [...balances]
    .filter(([, amountMinor]) => amountMinor !== 0n)
    .map(([userId, amountMinor]) => ({ userId, amountMinor }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

function simplifiedTransfers(entries: LedgerAmount[]): RepaymentTransfer[] {
  const balances = netBalances(entries);
  // The exact minimum-transfer search is exponential. It is useful for normal
  // household-sized groups, but a large group must never be able to stall an
  // API request. Above this bound, use the deterministic O(n log n) fallback,
  // which still settles every balance in at most n - 1 transfers.
  if (balances.length > 8) return greedyTransfers(balances);
  const amounts = balances.map((balance) => balance.amountMinor);
  const memo = new Map<string, RepaymentTransfer[]>();

  function settle(): RepaymentTransfer[] {
    const key = amounts.join(",");
    const cached = memo.get(key);
    if (cached) return cached;

    if (amounts.every((amount) => amount === 0n)) return [];

    let best: RepaymentTransfer[] | undefined;
    const seenTransitions = new Set<string>();
    for (let debtor = 0; debtor < amounts.length; debtor += 1) {
      const debt = amounts[debtor] ?? 0n;
      if (debt >= 0n) continue;
      for (let creditor = 0; creditor < amounts.length; creditor += 1) {
        const credit = amounts[creditor] ?? 0n;
        if (credit <= 0n) continue;
        const transitionKey = `${debt}:${credit}`;
        if (seenTransitions.has(transitionKey)) continue;
        seenTransitions.add(transitionKey);

        const payment = -debt < credit ? -debt : credit;
        amounts[debtor] = debt + payment;
        amounts[creditor] = credit - payment;
        const candidate = [
          {
            fromUserId: balances[debtor]!.userId,
            toUserId: balances[creditor]!.userId,
            amountMinor: payment,
          },
          ...settle(),
        ];
        if (!best || candidate.length < best.length) best = candidate;
        amounts[debtor] = debt;
        amounts[creditor] = credit;
      }
    }

    const result = best ?? [];
    memo.set(key, result);
    return result;
  }

  return settle();
}

function greedyTransfers(
  balances: { userId: string; amountMinor: bigint }[],
): RepaymentTransfer[] {
  const debtors = balances
    .filter((balance) => balance.amountMinor < 0n)
    .map((balance) => ({
      userId: balance.userId,
      remainingMinor: -balance.amountMinor,
    }));
  const creditors = balances
    .filter((balance) => balance.amountMinor > 0n)
    .map((balance) => ({
      userId: balance.userId,
      remainingMinor: balance.amountMinor,
    }));
  const transfers: RepaymentTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amountMinor =
      debtor.remainingMinor < creditor.remainingMinor
        ? debtor.remainingMinor
        : creditor.remainingMinor;
    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountMinor,
    });
    debtor.remainingMinor -= amountMinor;
    creditor.remainingMinor -= amountMinor;
    if (debtor.remainingMinor === 0n) debtorIndex += 1;
    if (creditor.remainingMinor === 0n) creditorIndex += 1;
  }
  return transfers;
}

function pairwiseTransfers(entries: LedgerAmount[]): RepaymentTransfer[] {
  const pairs = new Map<
    string,
    { lowId: string; highId: string; lowOwesHighMinor: bigint }
  >();
  for (const entry of entries) {
    const [lowId, highId] = [entry.debtorId, entry.creditorId].sort();
    if (!lowId || !highId || lowId === highId) continue;
    const key = `${lowId}\u0000${highId}`;
    const pair = pairs.get(key) ?? {
      lowId,
      highId,
      lowOwesHighMinor: 0n,
    };
    pair.lowOwesHighMinor +=
      entry.debtorId === lowId
        ? entry.canonicalAmountMinor
        : -entry.canonicalAmountMinor;
    pairs.set(key, pair);
  }
  return [...pairs.values()]
    .filter((pair) => pair.lowOwesHighMinor !== 0n)
    .sort((left, right) =>
      `${left.lowId}\u0000${left.highId}`.localeCompare(
        `${right.lowId}\u0000${right.highId}`,
      ),
    )
    .map((pair) =>
      pair.lowOwesHighMinor > 0n
        ? {
            fromUserId: pair.lowId,
            toUserId: pair.highId,
            amountMinor: pair.lowOwesHighMinor,
          }
        : {
            fromUserId: pair.highId,
            toUserId: pair.lowId,
            amountMinor: -pair.lowOwesHighMinor,
          },
    );
}

export function repaymentPlan(
  entries: LedgerAmount[],
  simplifyDebts: boolean,
): RepaymentTransfer[] {
  return simplifyDebts
    ? simplifiedTransfers(entries)
    : pairwiseTransfers(entries);
}

export function viewerRepaymentBalances(
  transfers: RepaymentTransfer[],
  members: RepaymentMember[],
  viewerId: string,
): ViewerRepaymentBalance[] {
  const balancesByMember = new Map<string, bigint>();
  for (const transfer of transfers) {
    const viewerIsCreditor = transfer.toUserId === viewerId;
    const viewerIsDebtor = transfer.fromUserId === viewerId;
    if (!viewerIsCreditor && !viewerIsDebtor) continue;

    const memberId = viewerIsCreditor ? transfer.fromUserId : transfer.toUserId;
    const signedAmount = viewerIsCreditor
      ? transfer.amountMinor
      : -transfer.amountMinor;
    balancesByMember.set(
      memberId,
      (balancesByMember.get(memberId) ?? 0n) + signedAmount,
    );
  }

  return members
    .filter((member) => member.userId !== viewerId)
    .map((member) => ({
      ...member,
      amountMinor: balancesByMember.get(member.userId) ?? 0n,
    }))
    .filter((member) => member.amountMinor !== 0n)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function memberRepaymentSummaries(
  transfers: RepaymentTransfer[],
  members: (RepaymentMember & { avatarUrl?: string | null })[],
): MemberRepaymentSummary[] {
  const summaries = new Map<string, MemberRepaymentSummary>(
    members.map((member) => [
      member.userId,
      {
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl ?? null,
        owesMinor: 0n,
        lentMinor: 0n,
        relationships: [],
      },
    ]),
  );

  for (const transfer of transfers) {
    const debtor = summaries.get(transfer.fromUserId);
    const creditor = summaries.get(transfer.toUserId);
    if (!debtor || !creditor) continue;

    debtor.owesMinor += transfer.amountMinor;
    debtor.relationships.push({
      kind: "owes",
      counterpartyId: creditor.userId,
      counterpartyDisplayName: creditor.displayName,
      counterpartyAvatarUrl: creditor.avatarUrl,
      amountMinor: transfer.amountMinor,
    });
    creditor.lentMinor += transfer.amountMinor;
    creditor.relationships.push({
      kind: "lent",
      counterpartyId: debtor.userId,
      counterpartyDisplayName: debtor.displayName,
      counterpartyAvatarUrl: debtor.avatarUrl,
      amountMinor: transfer.amountMinor,
    });
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      relationships: summary.relationships.sort((left, right) =>
        left.kind === right.kind
          ? left.counterpartyDisplayName.localeCompare(
              right.counterpartyDisplayName,
            )
          : left.kind === "owes"
            ? -1
            : 1,
      ),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
