import {
  groupBalanceLines,
  groupListBalanceLines,
  overallGroupBalanceLines,
} from "./group-balance-summary";

describe("groupBalanceLines", () => {
  it("separates people the viewer owes from people who owe the viewer", () => {
    expect(
      groupBalanceLines(
        [
          {
            userId: "alex",
            displayName: "Alex",
            balance: { currency: "EUR", minor: "-1250" },
          },
          {
            userId: "sam",
            displayName: "Sam",
            balance: { currency: "EUR", minor: "825" },
          },
        ],
        3,
        "EUR",
      ),
    ).toEqual([
      {
        key: "owes",
        text: "You owe Alex 12.50 EUR",
        tone: "negative",
      },
      {
        key: "owed",
        text: "Sam owes you 8.25 EUR",
        tone: "positive",
      },
    ]);
  });

  it("uses one compact settled subtitle when there are no balances", () => {
    expect(groupBalanceLines([], 4, "USD")).toEqual([
      {
        key: "settled",
        text: "All settled up · 4 members · USD",
        tone: "muted",
      },
    ]);
  });
});

describe("groupListBalanceLines", () => {
  it("shows both repayment directions without member or currency metadata", () => {
    expect(
      groupListBalanceLines([
        {
          userId: "alex",
          displayName: "Alex",
          balance: { currency: "EUR", minor: "-1250" },
        },
        {
          userId: "sam",
          displayName: "Sam",
          balance: { currency: "EUR", minor: "825" },
        },
      ]),
    ).toEqual([
      {
        key: "owes",
        text: "You owe Alex 12.50 EUR",
        tone: "negative",
      },
      {
        key: "owed",
        text: "Sam owes you 8.25 EUR",
        tone: "positive",
      },
    ]);
  });

  it("uses a plain settled subtitle when no payments remain", () => {
    expect(groupListBalanceLines([])).toEqual([
      {
        key: "settled",
        text: "All settled up",
        tone: "muted",
      },
    ]);
  });
});

describe("overallGroupBalanceLines", () => {
  it("totals owed and owing balances separately per currency", () => {
    expect(
      overallGroupBalanceLines([
        {
          memberBalances: [
            {
              userId: "alex",
              displayName: "Alex",
              balance: { currency: "EUR", minor: "-1200" },
            },
          ],
        },
        {
          memberBalances: [
            {
              userId: "sam",
              displayName: "Sam",
              balance: { currency: "EUR", minor: "500" },
            },
            {
              userId: "jamie",
              displayName: "Jamie",
              balance: { currency: "USD", minor: "800" },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        key: "owes-EUR",
        text: "You owe 12.00 EUR",
        tone: "negative",
      },
      {
        key: "owed-EUR",
        text: "You are owed 5.00 EUR",
        tone: "positive",
      },
      {
        key: "owed-USD",
        text: "You are owed 8.00 USD",
        tone: "positive",
      },
    ]);
  });

  it("only calls the overview settled when every group is settled", () => {
    expect(
      overallGroupBalanceLines([
        { memberBalances: [] },
        { memberBalances: [] },
      ]),
    ).toEqual([
      {
        key: "settled",
        text: "All groups are settled up",
        tone: "muted",
      },
    ]);
  });
});
