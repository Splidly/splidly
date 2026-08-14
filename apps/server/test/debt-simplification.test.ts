import { describe, expect, it } from "vitest";
import {
  memberRepaymentSummaries,
  repaymentPlan,
  viewerRepaymentBalances,
  type LedgerAmount,
} from "../src/domain/debt-simplification";

const amount = (
  debtorId: string,
  creditorId: string,
  canonicalAmountMinor: bigint,
): LedgerAmount => ({ debtorId, creditorId, canonicalAmountMinor });

describe("repaymentPlan", () => {
  it("collapses transitive group debt into one payment", () => {
    const entries = [
      amount("alex", "bea", 1_000n),
      amount("bea", "chris", 1_000n),
    ];

    expect(repaymentPlan(entries, true)).toEqual([
      {
        fromUserId: "alex",
        toUserId: "chris",
        amountMinor: 1_000n,
      },
    ]);
    expect(repaymentPlan(entries, false)).toHaveLength(2);
  });

  it("nets every member and uses no more payments than necessary", () => {
    const plan = repaymentPlan(
      [
        amount("a", "d", 800n),
        amount("b", "d", 200n),
        amount("b", "e", 500n),
        amount("c", "e", 500n),
      ],
      true,
    );

    expect(plan).toEqual([
      { fromUserId: "a", toUserId: "d", amountMinor: 800n },
      { fromUserId: "b", toUserId: "d", amountMinor: 200n },
      { fromUserId: "b", toUserId: "e", amountMinor: 500n },
      { fromUserId: "c", toUserId: "e", amountMinor: 500n },
    ]);
  });

  it("finds independent zero-sum subsets to avoid an extra transfer", () => {
    const plan = repaymentPlan(
      [
        amount("a", "d", 600n),
        amount("a", "f", 300n),
        amount("b", "e", 800n),
        amount("c", "f", 700n),
      ],
      true,
    );

    expect(plan).toHaveLength(4);
  });

  it("cancels opposite obligations between the same pair when disabled", () => {
    expect(
      repaymentPlan([amount("a", "b", 1_000n), amount("b", "a", 350n)], false),
    ).toEqual([{ fromUserId: "a", toUserId: "b", amountMinor: 650n }]);
  });

  it("returns the viewer's signed balances with every repayment counterparty", () => {
    expect(
      viewerRepaymentBalances(
        [
          { fromUserId: "viewer", toUserId: "alex", amountMinor: 800n },
          { fromUserId: "sam", toUserId: "viewer", amountMinor: 1_200n },
          { fromUserId: "alex", toUserId: "sam", amountMinor: 400n },
        ],
        [
          { userId: "viewer", displayName: "Viewer" },
          { userId: "sam", displayName: "Sam" },
          { userId: "alex", displayName: "Alex" },
        ],
        "viewer",
      ),
    ).toEqual([
      { userId: "alex", displayName: "Alex", amountMinor: -800n },
      { userId: "sam", displayName: "Sam", amountMinor: 1_200n },
    ]);
  });

  it("settles large groups without entering the exponential search", () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      amount(`debtor-${index}`, `creditor-${index}`, BigInt(index + 1) * 100n),
    );

    const plan = repaymentPlan(entries, true);

    expect(plan.length).toBeLessThanOrEqual(39);
    expect(
      plan.reduce((total, transfer) => total + transfer.amountMinor, 0n),
    ).toBe(21_000n);
    const remaining = new Map<string, bigint>();
    for (const entry of entries) {
      remaining.set(
        entry.debtorId,
        (remaining.get(entry.debtorId) ?? 0n) - entry.canonicalAmountMinor,
      );
      remaining.set(
        entry.creditorId,
        (remaining.get(entry.creditorId) ?? 0n) + entry.canonicalAmountMinor,
      );
    }
    for (const transfer of plan) {
      remaining.set(
        transfer.fromUserId,
        (remaining.get(transfer.fromUserId) ?? 0n) + transfer.amountMinor,
      );
      remaining.set(
        transfer.toUserId,
        (remaining.get(transfer.toUserId) ?? 0n) - transfer.amountMinor,
      );
    }
    expect([...remaining.values()].every((amount) => amount === 0n)).toBe(true);
  });
});

describe("memberRepaymentSummaries", () => {
  it("lists every member with separate owed and lent relationships", () => {
    expect(
      memberRepaymentSummaries(
        [
          { fromUserId: "alex", toUserId: "sam", amountMinor: 1_000n },
          { fromUserId: "bea", toUserId: "alex", amountMinor: 1_500n },
        ],
        [
          { userId: "sam", displayName: "Sam", avatarUrl: null },
          { userId: "alex", displayName: "Alex", avatarUrl: "alex.png" },
          { userId: "bea", displayName: "Bea", avatarUrl: null },
          { userId: "chris", displayName: "Chris", avatarUrl: null },
        ],
      ),
    ).toEqual([
      {
        userId: "alex",
        displayName: "Alex",
        avatarUrl: "alex.png",
        owesMinor: 1_000n,
        lentMinor: 1_500n,
        relationships: [
          {
            kind: "owes",
            counterpartyId: "sam",
            counterpartyDisplayName: "Sam",
            counterpartyAvatarUrl: null,
            amountMinor: 1_000n,
          },
          {
            kind: "lent",
            counterpartyId: "bea",
            counterpartyDisplayName: "Bea",
            counterpartyAvatarUrl: null,
            amountMinor: 1_500n,
          },
        ],
      },
      {
        userId: "bea",
        displayName: "Bea",
        avatarUrl: null,
        owesMinor: 1_500n,
        lentMinor: 0n,
        relationships: [
          {
            kind: "owes",
            counterpartyId: "alex",
            counterpartyDisplayName: "Alex",
            counterpartyAvatarUrl: "alex.png",
            amountMinor: 1_500n,
          },
        ],
      },
      {
        userId: "chris",
        displayName: "Chris",
        avatarUrl: null,
        owesMinor: 0n,
        lentMinor: 0n,
        relationships: [],
      },
      {
        userId: "sam",
        displayName: "Sam",
        avatarUrl: null,
        owesMinor: 0n,
        lentMinor: 1_000n,
        relationships: [
          {
            kind: "lent",
            counterpartyId: "alex",
            counterpartyDisplayName: "Alex",
            counterpartyAvatarUrl: "alex.png",
            amountMinor: 1_000n,
          },
        ],
      },
    ]);
  });
});
