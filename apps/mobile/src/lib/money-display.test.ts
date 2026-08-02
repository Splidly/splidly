import {
  currencySymbol,
  formatConvertedMoney,
  formatExchangeRate,
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

  it("limits exchange-rate metadata to five decimal places", () => {
    expect(formatExchangeRate("1.23456789")).toBe("1.23456");
    expect(formatExchangeRate("1.25000000")).toBe("1.25");
    expect(formatExchangeRate("1")).toBe("1");
  });
});
