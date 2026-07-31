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
            displayName: "Lasse Petzel",
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
        key: "negative-alex",
        label: "You owe Lasse Petzel",
        compactLabel: "You owe L.P.",
        text: "You owe Lasse Petzel 12.50 €",
        amount: "12.50 €",
        tone: "negative",
      },
      {
        key: "positive-sam",
        label: "Sam owes you",
        compactLabel: "S. owes you",
        text: "Sam owes you 8.25 €",
        amount: "8.25 €",
        tone: "positive",
      },
    ]);
  });

  it("uses one compact settled subtitle when there are no balances", () => {
    expect(groupBalanceLines([], 4, "USD")).toEqual([
      {
        key: "settled",
        label: "All settled up · 4 members · $",
        text: "All settled up · 4 members · $",
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
        key: "negative-alex",
        label: "You owe Alex",
        compactLabel: "You owe A.",
        text: "You owe Alex 12.50 €",
        amount: "12.50 €",
        tone: "negative",
      },
      {
        key: "positive-sam",
        label: "Sam owes you",
        compactLabel: "S. owes you",
        text: "Sam owes you 8.25 €",
        amount: "8.25 €",
        tone: "positive",
      },
    ]);
  });

  it("omits a redundant subtitle when the trailing status is settled", () => {
    expect(groupListBalanceLines([])).toEqual([]);
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
        label: "You owe",
        text: "You owe 12.00 €",
        amount: "12.00 €",
        tone: "negative",
      },
      {
        key: "owed-EUR",
        label: "You are owed",
        text: "You are owed 5.00 €",
        amount: "5.00 €",
        tone: "positive",
      },
      {
        key: "owed-USD",
        label: "You are owed",
        text: "You are owed $8.00",
        amount: "$8.00",
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
        label: "All groups are settled up",
        text: "All groups are settled up",
        tone: "muted",
      },
    ]);
  });
});
