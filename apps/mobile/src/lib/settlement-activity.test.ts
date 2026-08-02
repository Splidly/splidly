import {
  settlementPaymentSummary,
} from "./settlement-activity";

describe("settlement activity presentation", () => {
  it("personalizes payments involving the viewer", () => {
    expect(
      settlementPaymentSummary({
        from: { displayName: "Alex", isViewer: false },
        to: { displayName: "Lasse", isViewer: true },
        amount: { currency: "EUR", minor: "1234" },
      }),
    ).toBe("Alex paid you 12.34 €");

    expect(
      settlementPaymentSummary({
        from: { displayName: "Lasse", isViewer: true },
        to: { displayName: "Flo", isViewer: false },
        amount: { currency: "EUR", minor: "500" },
      }),
    ).toBe("You paid Flo 5.00 €");
  });

  it("names both people when the viewer was not involved", () => {
    expect(
      settlementPaymentSummary({
        from: { displayName: "Alex", isViewer: false },
        to: { displayName: "Flo", isViewer: false },
        amount: { currency: "EUR", minor: "500" },
      }),
    ).toBe("Alex paid Flo 5.00 €");
  });
});
