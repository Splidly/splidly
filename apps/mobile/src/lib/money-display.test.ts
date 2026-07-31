import {
  currencySymbol,
  formatConvertedMoney,
  formatMoney,
} from "./money-display";

describe("money display", () => {
  it("uses deterministic currency symbols without relying on Intl parts", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(formatMoney(1_234n, "EUR")).toBe("12.34 €");
    expect(formatMoney(-1_234n, "EUR")).toBe("-12.34 €");
    expect(formatMoney(500n, "BAM")).toBe("5.00 KM");
  });

  it("keeps an ISO code when there is no usable symbol", () => {
    expect(formatMoney(123n, "XXX")).toBe("1.23 XXX");
  });

  it("rounds converted displays to exactly two decimal places", () => {
    expect(formatConvertedMoney(3_315n, "KWD")).toBe("3.32 KWD");
    expect(formatConvertedMoney(1_000n, "JPY")).toBe("¥1000.00");
    expect(formatConvertedMoney(-3_314n, "KWD")).toBe("-3.31 KWD");
  });
});
