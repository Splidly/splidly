import type { Database } from "@splidly/db";
import type { RateSnapshot } from "@splidly/shared";
import { describe, expect, it } from "vitest";
import { resolveRates } from "../src/domain/finance";

const usdRate: RateSnapshot = {
  base: "EUR",
  quote: "USD",
  rate: "1.125",
  provider: "Stored provider",
  providerDate: "2026-07-28",
  source: "automatic",
};

describe("resolveRates", () => {
  it("preserves a stored frozen rate when an expense edit has no new quote", async () => {
    const rates = await resolveRates({
      db: {} as Database,
      userId: "user-1",
      base: "EUR",
      targets: ["EUR", "USD"],
      quoteId: undefined,
      overrides: [],
      fallbackRates: [usdRate],
    });

    expect(rates).toEqual([
      expect.objectContaining({
        base: "EUR",
        quote: "EUR",
        rate: "1",
      }),
      usdRate,
    ]);
  });

  it("uses an explicit correction ahead of the stored rate", async () => {
    const correction: RateSnapshot = {
      ...usdRate,
      rate: "1.2",
      provider: "User override",
      source: "manual",
    };
    const rates = await resolveRates({
      db: {} as Database,
      userId: "user-1",
      base: "EUR",
      targets: ["USD"],
      quoteId: undefined,
      overrides: [correction],
      fallbackRates: [usdRate],
    });

    expect(rates).toEqual([correction]);
  });
});
