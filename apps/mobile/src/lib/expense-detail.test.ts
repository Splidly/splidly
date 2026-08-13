import { expenseTotalInCurrency } from "./expense-detail";

describe("expense detail currency presentation", () => {
  it("uses the saved rate for the viewer's home-currency total", () => {
    expect(
      expenseTotalInCurrency(10_00n, "USD", "EUR", [
        {
          base: "USD",
          quote: "EUR",
          rate: "0.92",
          provider: "ECB",
          providerDate: "2026-08-13",
          source: "automatic",
        },
      ]),
    ).toBe(9_20n);
  });

  it("returns the original total when the currencies match", () => {
    expect(expenseTotalInCurrency(12_34n, "EUR", "EUR", [])).toBe(12_34n);
  });

  it("does not invent a conversion when no saved rate exists", () => {
    expect(expenseTotalInCurrency(10_00n, "USD", "EUR", [])).toBeUndefined();
  });
});
