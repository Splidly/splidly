import { describe, expect, it } from "vitest";
import {
  allocateByUser,
  expenseTransfers,
} from "../src/domain/expense-allocation";

describe("expenseTransfers", () => {
  it("nets multiple payers against everyone’s consumed share", () => {
    expect(
      expenseTransfers(
        new Map([
          ["a", 5_000n],
          ["b", 2_000n],
        ]),
        new Map([
          ["a", 2_000n],
          ["b", 2_000n],
          ["c", 3_000n],
        ]),
      ),
    ).toEqual([
      {
        debtorId: "c",
        creditorId: "a",
        sourceAmountMinor: 3_000n,
      },
    ]);
  });

  it("creates no debt when each person paid their own share", () => {
    expect(
      expenseTransfers(
        new Map([
          ["a", 2_000n],
          ["b", 3_000n],
        ]),
        new Map([
          ["a", 2_000n],
          ["b", 3_000n],
        ]),
      ),
    ).toEqual([]);
  });

  it("only transfers the payer’s amount above their own share", () => {
    expect(
      expenseTransfers(
        new Map([["a", 7_000n]]),
        new Map([
          ["a", 3_500n],
          ["b", 3_500n],
        ]),
      ),
    ).toEqual([
      {
        debtorId: "b",
        creditorId: "a",
        sourceAmountMinor: 3_500n,
      },
    ]);
  });

  it("rejects payment totals that do not match the split", () => {
    expect(() =>
      expenseTransfers(
        new Map([["a", 4_999n]]),
        new Map([["b", 5_000n]]),
      ),
    ).toThrow("must match");
  });

  it("uses user-stable rounding regardless of map insertion order", () => {
    expect(
      allocateByUser(
        10n,
        new Map([
          ["b", 1n],
          ["a", 1n],
          ["c", 1n],
        ]),
      ),
    ).toEqual(
      new Map([
        ["a", 4n],
        ["b", 3n],
        ["c", 3n],
      ]),
    );
  });
});
