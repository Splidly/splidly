import { describe, expect, it } from "vitest";
import {
  groupColorPresets,
  groupColorSchema,
  groupIconKeys,
  groupIconKeySchema,
  expenseMutationSchema,
  paymentInputSchema,
  splitInputSchema,
} from "../src";

describe("groupIconKeySchema", () => {
  it("accepts every supported semantic group icon", () => {
    for (const iconKey of groupIconKeys) {
      expect(groupIconKeySchema.parse(iconKey)).toBe(iconKey);
    }
  });

  it("rejects platform-specific and unknown icon names", () => {
    expect(groupIconKeySchema.safeParse("person.3.fill").success).toBe(false);
    expect(groupIconKeySchema.safeParse("unknown").success).toBe(false);
  });
});

describe("expense allocation contracts", () => {
  it("requires unique positive payer contributions", () => {
    expect(
      paymentInputSchema.parse([
        { userId: "a", amountMinor: "5000" },
        { userId: "b", amountMinor: "2000" },
      ]),
    ).toHaveLength(2);
    expect(
      paymentInputSchema.safeParse([
        { userId: "a", amountMinor: "5000" },
        { userId: "a", amountMinor: "2000" },
      ]).success,
    ).toBe(false);
    expect(
      paymentInputSchema.safeParse([
        { userId: "a", amountMinor: "0" },
      ]).success,
    ).toBe(false);
  });

  it("accepts all five split modes", () => {
    const values = [
      { mode: "equal", participantIds: ["a", "b"] },
      {
        mode: "exact",
        shares: [{ userId: "a", amountMinor: "100" }],
      },
      {
        mode: "percentage",
        shares: [{ userId: "a", percentage: "100" }],
      },
      {
        mode: "shares",
        shares: [{ userId: "a", shares: "1" }],
      },
      {
        mode: "itemized",
        items: [
          {
            id: "item-1",
            description: "Meal",
            amountMinor: "100",
            participantIds: ["a"],
          },
        ],
      },
    ] as const;

    for (const value of values) {
      expect(splitInputSchema.safeParse(value).success).toBe(true);
    }
  });

  it("requires either modern payments or a legacy payer", () => {
    const base = {
      context: {
        type: "group" as const,
        groupId: "11111111-1111-4111-8111-111111111111",
      },
      clientMutationId: "22222222-2222-4222-8222-222222222222",
      description: "Dinner",
      occurredAt: "2026-07-30T12:00:00.000Z",
      amount: { currency: "EUR", minor: "7000" },
      split: { mode: "equal" as const, participantIds: ["a", "b"] },
    };
    expect(
      expenseMutationSchema.safeParse({
        ...base,
        payments: [
          { userId: "a", amountMinor: "5000" },
          { userId: "b", amountMinor: "2000" },
        ],
      }).success,
    ).toBe(true);
    expect(
      expenseMutationSchema.safeParse({ ...base, payerId: "a" }).success,
    ).toBe(true);
    expect(expenseMutationSchema.safeParse(base).success).toBe(false);
  });
});

describe("groupColorSchema", () => {
  it("accepts six-digit colors and normalizes them for storage", () => {
    expect(groupColorSchema.parse("#a1b2c3")).toBe("#A1B2C3");
  });

  it("keeps every preset valid and rejects non-hex values", () => {
    for (const color of groupColorPresets) {
      expect(groupColorSchema.parse(color)).toBe(color);
    }
    expect(groupColorSchema.safeParse("purple").success).toBe(false);
    expect(groupColorSchema.safeParse("#1234").success).toBe(false);
  });
});
