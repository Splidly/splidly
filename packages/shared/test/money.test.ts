import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  convertMinor,
  formatMinor,
  parseDecimalToMinor,
  splitSourceAmount,
} from "../src";

describe("money", () => {
  it("parses zero, two and three-decimal currencies", () => {
    expect(parseDecimalToMinor("100", "JPY")).toBe(100n);
    expect(parseDecimalToMinor("10.25", "EUR")).toBe(1_025n);
    expect(parseDecimalToMinor("1.234", "KWD")).toBe(1_234n);
    expect(formatMinor(1_234n, "KWD")).toBe("1.234");
  });

  it("converts between different minor unit scales using half-up rounding", () => {
    expect(convertMinor(1_000n, "JPY", "EUR", "0.00625")).toBe(625n);
    expect(convertMinor(1_000n, "EUR", "KWD", "0.3315")).toBe(3_315n);
  });

  it("uses deterministic largest remainders", () => {
    expect(allocateByWeights(100n, [1n, 1n, 1n])).toEqual([34n, 33n, 33n]);
    expect(allocateByWeights(10n, [1n, 2n])).toEqual([3n, 7n]);
  });

  it("validates exact splits", () => {
    expect(
      splitSourceAmount(100n, {
        mode: "exact",
        shares: [
          { userId: "a", amountMinor: "60" },
          { userId: "b", amountMinor: "40" },
        ],
      }),
    ).toEqual(
      new Map([
        ["a", 60n],
        ["b", 40n],
      ]),
    );
    expect(() =>
      splitSourceAmount(100n, {
        mode: "exact",
        shares: [{ userId: "a", amountMinor: "99" }],
      }),
    ).toThrow("must equal");
  });

  it("allocates percentage and weighted-share splits deterministically", () => {
    expect(
      splitSourceAmount(10_00n, {
        mode: "percentage",
        shares: [
          { userId: "a", percentage: "12.5" },
          { userId: "b", percentage: "87.5" },
        ],
      }),
    ).toEqual(
      new Map([
        ["a", 125n],
        ["b", 875n],
      ]),
    );
    expect(() =>
      splitSourceAmount(10_00n, {
        mode: "percentage",
        shares: [
          { userId: "a", percentage: "40" },
          { userId: "b", percentage: "50" },
        ],
      }),
    ).toThrow("100%");
    expect(
      splitSourceAmount(10n, {
        mode: "shares",
        shares: [
          { userId: "a", shares: "0" },
          { userId: "b", shares: "1" },
          { userId: "c", shares: "2" },
        ],
      }),
    ).toEqual(
      new Map([
        ["a", 0n],
        ["b", 3n],
        ["c", 7n],
      ]),
    );
  });

  it("aggregates itemized shares and validates the item total", () => {
    expect(
      splitSourceAmount(15_00n, {
        mode: "itemized",
        items: [
          {
            id: "pizza",
            description: "Pizza",
            amountMinor: "1200",
            participantIds: ["a", "b"],
          },
          {
            id: "drink",
            description: "Drink",
            amountMinor: "300",
            participantIds: ["b"],
          },
        ],
      }),
    ).toEqual(
      new Map([
        ["a", 600n],
        ["b", 900n],
      ]),
    );
    expect(() =>
      splitSourceAmount(15_00n, {
        mode: "itemized",
        items: [
          {
            id: "pizza",
            description: "Pizza",
            amountMinor: "1400",
            participantIds: ["a"],
          },
        ],
      }),
    ).toThrow("must equal");
  });
});
