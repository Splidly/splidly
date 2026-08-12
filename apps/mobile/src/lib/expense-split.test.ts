import type { CurrencyCode } from "@splidly/shared";
import {
  createExpenseSplitDraft,
  expenseSplitDraftFromInput,
  expenseSplitStatus,
  type SplitParticipant,
} from "./expense-split";

const currency = "EUR" as CurrencyCode;
const participants: SplitParticipant[] = [
  { userId: "a", displayName: "Alex", homeCurrency: "EUR" },
  { userId: "b", displayName: "Bea", homeCurrency: "EUR" },
];

describe("expense split drafts", () => {
  it("allows untitled itemized entries and counts amounts before other validation", () => {
    const draft = {
      ...createExpenseSplitDraft(participants, 7_000n, currency),
      mode: "itemized" as const,
      items: [
        {
          id: "item-1",
          description: "",
          amount: "70",
          participantIds: [],
          allocationMode: "equal" as const,
          exactAmounts: {},
          percentages: {},
          shares: {},
        },
      ],
    };

    expect(expenseSplitStatus(draft, 7_000n, currency)).toMatchObject({
      valid: false,
      assignedMinor: 7_000n,
      message: "Assign every item to at least one person",
    });
    expect(
      expenseSplitStatus(
        {
          ...draft,
          items: [{ ...draft.items[0]!, participantIds: ["a"] }],
        },
        7_000n,
        currency,
      ),
    ).toMatchObject({ valid: true });
  });

  it("starts with a complete even allocation", () => {
    const draft = createExpenseSplitDraft(participants, 7_000n, currency);
    expect(expenseSplitStatus(draft, 7_000n, currency)).toMatchObject({
      valid: true,
      input: { mode: "equal", participantIds: ["a", "b"] },
    });
  });

  it("blocks custom amounts until they match the expense", () => {
    const draft = {
      ...createExpenseSplitDraft(participants, 7_000n, currency),
      mode: "exact" as const,
      exactAmounts: { a: "50", b: "10" },
    };
    expect(expenseSplitStatus(draft, 7_000n, currency)).toMatchObject({
      valid: false,
      assignedMinor: 6_000n,
    });

    draft.exactAmounts.b = "20";
    expect(expenseSplitStatus(draft, 7_000n, currency)).toMatchObject({
      valid: true,
      assignedMinor: 7_000n,
    });
  });

  it("restores stored percentage and itemized splits for editing", () => {
    const percentage = expenseSplitDraftFromInput(
      {
        mode: "percentage",
        shares: [
          { userId: "a", percentage: "25" },
          { userId: "b", percentage: "75" },
        ],
      },
      participants,
      1_000n,
      currency,
    );
    expect(expenseSplitStatus(percentage, 1_000n, currency).valid).toBe(true);

    const itemized = expenseSplitDraftFromInput(
      {
        mode: "itemized",
        items: [
          {
            id: "meal",
            description: "Meal",
            amountMinor: "1000",
            participantIds: ["a", "b"],
          },
        ],
      },
      participants,
      1_000n,
      currency,
    );
    expect(itemized.items[0]?.amount).toBe("10.00");
    expect(expenseSplitStatus(itemized, 1_000n, currency).valid).toBe(true);
  });

  it("validates percentage, shares, and itemized completion", () => {
    const base = createExpenseSplitDraft(participants, 7_000n, currency);
    expect(
      expenseSplitStatus(
        {
          ...base,
          mode: "percentage",
          percentages: { a: "40", b: "50" },
        },
        7_000n,
        currency,
      ),
    ).toMatchObject({ valid: false, assignedPercentage: 90 });
    expect(
      expenseSplitStatus(
        {
          ...base,
          mode: "shares",
          shares: { a: "0", b: "0" },
        },
        7_000n,
        currency,
      ),
    ).toMatchObject({ valid: false, totalShares: 0n });
    expect(
      expenseSplitStatus(
        {
          ...base,
          mode: "itemized",
          items: [
            {
              id: "meal",
              description: "Meal",
              amount: "60",
              participantIds: ["a", "b"],
              allocationMode: "equal",
              exactAmounts: {},
              percentages: {},
              shares: {},
            },
          ],
        },
        7_000n,
        currency,
      ),
    ).toMatchObject({ valid: false, assignedMinor: 6_000n });
  });

  it("restores and submits custom allocations within itemized splits", () => {
    const draft = expenseSplitDraftFromInput(
      {
        mode: "itemized",
        items: [
          {
            id: "meal",
            description: "Meal",
            amountMinor: "1000",
            participantIds: ["a", "b"],
            allocation: {
              mode: "percentage",
              shares: [
                { userId: "a", percentage: "25" },
                { userId: "b", percentage: "75" },
              ],
            },
          },
        ],
      },
      participants,
      1_000n,
      currency,
    );

    expect(draft.items[0]).toMatchObject({
      allocationMode: "percentage",
      percentages: { a: "25", b: "75" },
    });
    expect(expenseSplitStatus(draft, 1_000n, currency)).toMatchObject({
      valid: true,
      input: {
        mode: "itemized",
        items: [
          {
            allocation: {
              mode: "percentage",
              shares: [
                { userId: "a", percentage: "25" },
                { userId: "b", percentage: "75" },
              ],
            },
          },
        ],
      },
    });
  });
});
