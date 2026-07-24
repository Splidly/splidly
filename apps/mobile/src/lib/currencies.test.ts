import type { CurrencyCode } from "@splidly/shared";
import {
  addRecentCurrency,
  currencies,
  getCurrency,
  isSupportedCurrency,
} from "./currencies";

describe("currencies", () => {
  test("contains the unique current ISO 4217 list", () => {
    const codes = currencies.map(({ code }) => code);

    expect(codes).toHaveLength(178);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["EUR", "USD", "JPY", "XAD"]));
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("EURO")).toBe(false);
    expect(getCurrency("USD")?.name).toBe("US Dollar");
    expect(getCurrency("PAB")?.name).toBe("Balboa");
  });

  test("keeps five currencies in most-recent-first order", () => {
    const initial = ["EUR", "USD", "JPY", "GBP", "CHF"] as CurrencyCode[];

    expect(addRecentCurrency(initial, "USD")).toEqual([
      "USD",
      "EUR",
      "JPY",
      "GBP",
      "CHF",
    ]);
    expect(addRecentCurrency(initial, "CAD")).toEqual([
      "CAD",
      "EUR",
      "USD",
      "JPY",
      "GBP",
    ]);
  });
});
