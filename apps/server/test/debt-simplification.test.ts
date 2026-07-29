import { describe, expect, it } from "vitest";
import {
  repaymentPlan,
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
      repaymentPlan(
        [
          amount("a", "b", 1_000n),
          amount("b", "a", 350n),
        ],
        false,
      ),
    ).toEqual([
      { fromUserId: "a", toUserId: "b", amountMinor: 650n },
    ]);
  });
});
