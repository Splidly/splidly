import {
  expensePaymentSummary,
} from "./expense-activity";

describe("expense activity presentation", () => {
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
      expensePaymentSummary(
        [
          { displayName: "Alex", isViewer: false },
          { displayName: "Bea", isViewer: false },
        ],
        { currency: "USD", minor: "7200" },
      ),
    ).toBe("Alex + Bea paid $72.00");

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
