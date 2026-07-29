import { groupBalanceLines } from "./group-balance-summary";

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
