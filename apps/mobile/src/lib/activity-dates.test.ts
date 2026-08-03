import {
  formatActivityDateHeader,
  groupActivityByDate,
} from "./activity-dates";

const now = new Date(2026, 6, 22, 18);

describe("activity date grouping", () => {
  it("uses relative labels for the two most recent calendar days", () => {
    expect(
      formatActivityDateHeader(new Date(2026, 6, 22, 9), "en-US", now),
    ).toBe("Today");
    expect(
      formatActivityDateHeader(new Date(2026, 6, 21, 23), "en-US", now),
    ).toBe("Yesterday");
  });

  it("groups and sorts every item from the same local date", () => {
    const groups = groupActivityByDate(
      [
        { id: "older", occurredAt: new Date(2026, 6, 20, 12) },
        { id: "late", occurredAt: new Date(2026, 6, 21, 19) },
        { id: "early", occurredAt: new Date(2026, 6, 21, 8) },
      ],
      "en-US",
      now,
    );

    expect(groups).toEqual([
      {
        key: "2026-07-21",
        label: "Yesterday",
        items: [
          { id: "late", occurredAt: new Date(2026, 6, 21, 19) },
          { id: "early", occurredAt: new Date(2026, 6, 21, 8) },
        ],
      },
      {
        key: "2026-07-20",
        label: "Monday, Jul 20",
        items: [
          { id: "older", occurredAt: new Date(2026, 6, 20, 12) },
        ],
      },
    ]);
  });

  it("uses creation time to order activity recorded for the same day", () => {
    const occurredAt = new Date(2026, 6, 21, 12);
    const groups = groupActivityByDate(
      [
        {
          id: "older-expense",
          occurredAt,
          createdAt: new Date(2026, 6, 22, 9),
        },
        {
          id: "new-payment",
          occurredAt,
          createdAt: new Date(2026, 6, 22, 11),
        },
      ],
      "en-US",
      now,
    );

    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "new-payment",
      "older-expense",
    ]);
  });
});
