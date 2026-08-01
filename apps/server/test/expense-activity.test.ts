import { describe, expect, it } from "vitest";
import { expenseActivitySummary } from "../src/domain/expense-activity";

describe("expenseActivitySummary", () => {
  it("reports the viewer's net payment as lending", () => {
    expect(
      expenseActivitySummary({
        sourceCurrency: "EUR",
        sourceAmountMinor: 7_200n,
        legacyPayerId: "alex",
        payments: [
          {
            userId: "viewer",
            displayName: "You",
            sourceAmountMinor: 5_000n,
          },
          {
            userId: "alex",
            displayName: "Alex",
            sourceAmountMinor: 2_200n,
          },
        ],
        viewerUserId: "viewer",
        viewerShareMinor: 1_800n,
      }),
    ).toEqual({
      payers: [
        { userId: "alex", displayName: "Alex", isViewer: false },
        { userId: "viewer", displayName: "You", isViewer: true },
      ],
      paymentTotal: { currency: "EUR", minor: "7200" },
      viewerInvolvement: {
        kind: "lent",
        amount: { currency: "EUR", minor: "3200" },
      },
    });
  });

  it("reports borrowing and supports legacy single-payer expenses", () => {
    const summary = expenseActivitySummary({
      sourceCurrency: "USD",
      sourceAmountMinor: 4_500n,
      legacyPayerId: "alex",
      legacyPayerDisplayName: "Alex",
      payments: [],
      viewerUserId: "viewer",
      viewerShareMinor: 1_500n,
    });

    expect(summary.payers).toEqual([
      { userId: "alex", displayName: "Alex", isViewer: false },
    ]);
    expect(summary.paymentTotal).toEqual({ currency: "USD", minor: "4500" });
    expect(summary.viewerInvolvement).toEqual({
      kind: "borrowed",
      amount: { currency: "USD", minor: "1500" },
    });
  });

  it("distinguishes settled participation from no involvement", () => {
    const base = {
      sourceCurrency: "EUR" as const,
      sourceAmountMinor: 2_000n,
      legacyPayerId: "viewer",
      legacyPayerDisplayName: "Viewer",
      payments: [],
      viewerUserId: "viewer",
    };

    expect(
      expenseActivitySummary({ ...base, viewerShareMinor: 2_000n })
        .viewerInvolvement.kind,
    ).toBe("settled");
    expect(
      expenseActivitySummary({
        ...base,
        legacyPayerId: "alex",
        legacyPayerDisplayName: "Alex",
      }).viewerInvolvement.kind,
    ).toBe("none");
  });
});
