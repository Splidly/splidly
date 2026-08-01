import {
  expenseActivitySubtitle,
  expensePaymentSummary,
  formatExpenseActivityDate,
} from "./expense-activity";

describe("expense activity presentation", () => {
  it("formats a compact day and month", () => {
    expect(
      formatExpenseActivityDate(
        new Date("2026-07-20T12:00:00.000Z"),
        "en",
      ),
    ).toBe("20 Jul");
  });

  it("personalizes a single payer", () => {
    expect(
      expensePaymentSummary(
        [{ displayName: "Lasse", isViewer: true }],
        { currency: "EUR", minor: "7200" },
      ),
    ).toBe("You paid 72.00 €");
  });

  it("keeps multiple payer summaries compact", () => {
    expect(
      expenseActivitySubtitle({
        occurredAt: new Date("2026-07-20T12:00:00.000Z"),
        locale: "en",
        payers: [
          { displayName: "Alex", isViewer: false },
          { displayName: "Bea", isViewer: false },
        ],
        paymentTotal: { currency: "USD", minor: "7200" },
      }),
    ).toBe("20 Jul · Alex + Bea paid $72.00");

    expect(
      expensePaymentSummary(
        [
          { displayName: "Alex", isViewer: false },
          { displayName: "Bea", isViewer: false },
          { displayName: "Chris", isViewer: false },
        ],
        { currency: "USD", minor: "7200" },
      ),
    ).toBe("Alex + 2 others paid $72.00");
  });
});
