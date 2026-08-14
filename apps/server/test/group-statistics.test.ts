import { describe, expect, it } from "vitest";
import {
  buildGroupStatistics,
  resolveGroupStatisticsIconKey,
  statisticsBucketForPeriod,
} from "../src/domain/group-statistics";

describe("resolveGroupStatisticsIconKey", () => {
  it("keeps a manually selected Other category uncategorized", () => {
    expect(
      resolveGroupStatisticsIconKey({
        iconKey: "other",
        iconManuallySet: true,
        description: "Restaurant",
      }),
    ).toBe("other");
    expect(
      resolveGroupStatisticsIconKey({
        iconKey: "other",
        iconManuallySet: false,
        description: "Restaurant",
      }),
    ).toBe("dining");
  });
});

describe("buildGroupStatistics", () => {
  it("keeps payments and consumed shares separate across members", () => {
    const statistics = buildGroupStatistics({
      viewerUserId: "viewer",
      bucket: "month",
      members: [
        { userId: "viewer", displayName: "Viewer", avatarUrl: null },
        { userId: "alex", displayName: "Alex", avatarUrl: "alex.png" },
      ],
      expenses: [
        {
          id: "dinner",
          description: "Dinner",
          iconKey: "dining",
          occurredAt: new Date("2026-07-20T18:00:00.000Z"),
          canonicalAmountMinor: 12_000n,
          canonicalPayments: new Map([
            ["viewer", 9_000n],
            ["alex", 3_000n],
          ]),
          canonicalShares: new Map([
            ["viewer", 4_000n],
            ["alex", 8_000n],
          ]),
        },
        {
          id: "train",
          description: "Train",
          iconKey: "transport",
          occurredAt: new Date("2026-08-01T09:00:00.000Z"),
          canonicalAmountMinor: 6_000n,
          canonicalPayments: new Map([["alex", 6_000n]]),
          canonicalShares: new Map([
            ["viewer", 3_000n],
            ["alex", 3_000n],
          ]),
        },
      ],
    });

    expect(statistics).toMatchObject({
      totalSpentMinor: 18_000n,
      viewerPaidMinor: 9_000n,
      viewerShareMinor: 7_000n,
      expenseCount: 2,
      categories: [
        { iconKey: "dining", amountMinor: 12_000n },
        { iconKey: "transport", amountMinor: 6_000n },
      ],
      timeline: [
        { period: "2026-07", amountMinor: 12_000n },
        { period: "2026-08", amountMinor: 6_000n },
      ],
    });
    expect(statistics.members).toEqual([
      {
        userId: "alex",
        displayName: "Alex",
        avatarUrl: "alex.png",
        isViewer: false,
        paidMinor: 9_000n,
        shareMinor: 11_000n,
      },
      {
        userId: "viewer",
        displayName: "Viewer",
        avatarUrl: null,
        isViewer: true,
        paidMinor: 9_000n,
        shareMinor: 7_000n,
      },
    ]);
  });

  it("uses calendar buckets that fit the selected period", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(
      statisticsBucketForPeriod(
        from,
        new Date("2026-01-30T23:59:59.999Z"),
      ),
    ).toBe("day");
    expect(
      statisticsBucketForPeriod(
        from,
        new Date("2026-04-30T23:59:59.999Z"),
      ),
    ).toBe("week");
    expect(
      statisticsBucketForPeriod(
        from,
        new Date("2026-12-31T23:59:59.999Z"),
      ),
    ).toBe("month");
    expect(
      statisticsBucketForPeriod(
        from,
        new Date("2030-01-01T00:00:00.000Z"),
      ),
    ).toBe("year");
  });

  it("groups multi-month custom ranges into weeks", () => {
    const statistics = buildGroupStatistics({
      viewerUserId: "viewer",
      bucket: "week",
      members: [{ userId: "viewer", displayName: "Viewer", avatarUrl: null }],
      expenses: [
        {
          id: "monday",
          description: "Monday",
          iconKey: "other",
          occurredAt: new Date("2026-08-03T12:00:00.000Z"),
          canonicalAmountMinor: 1_000n,
          canonicalPayments: new Map([["viewer", 1_000n]]),
          canonicalShares: new Map([["viewer", 1_000n]]),
        },
        {
          id: "sunday",
          description: "Sunday",
          iconKey: "other",
          occurredAt: new Date("2026-08-09T12:00:00.000Z"),
          canonicalAmountMinor: 2_000n,
          canonicalPayments: new Map([["viewer", 2_000n]]),
          canonicalShares: new Map([["viewer", 2_000n]]),
        },
      ],
    });

    expect(statistics.timeline).toEqual([
      { period: "2026-08-03", amountMinor: 3_000n },
    ]);
  });

  it("returns useful zero values for a group without expenses", () => {
    expect(
      buildGroupStatistics({
        viewerUserId: "viewer",
        bucket: "day",
        members: [
          { userId: "viewer", displayName: "Viewer", avatarUrl: null },
        ],
        expenses: [],
      }),
    ).toMatchObject({
      totalSpentMinor: 0n,
      viewerPaidMinor: 0n,
      viewerShareMinor: 0n,
      expenseCount: 0,
      categories: [],
      timeline: [],
    });
  });
});
