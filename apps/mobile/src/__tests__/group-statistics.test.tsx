import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { semanticChartColorFor } from "../lib/avatar-colors";

const mockUseLocalSearchParams = jest.fn(
  (): {
    id: string;
    range?: string;
    filter?: string;
    category?: string;
    userId?: string;
    metric?: string;
    from?: string;
    to?: string;
  } => ({ id: "group-1" }),
);

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Stack: { Screen: () => null },
}));

jest.mock("@expo/ui", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  function Host({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return <View {...props}>{children}</View>;
  }
  const Icon = Object.assign(
    (props: Record<string, unknown>) => <View {...props} />,
    { select: (options: { ios: unknown }) => options.ios },
  );

  return { Host, Icon };
});

jest.mock("@expo/ui/community/datetime-picker", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  function DateTimePicker(props: {
    testID?: string;
    value: Date;
    onValueChange?: (event: unknown, date: Date) => void;
  }) {
    return <View {...props} />;
  }

  return { __esModule: true, default: DateTimePicker, DateTimePicker };
});

jest.mock("@expo/ui/community/segmented-control", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  function SegmentedControl(props: Record<string, unknown>) {
    return <View {...props} />;
  }

  return { __esModule: true, default: SegmentedControl };
});

jest.mock("@expo/ui/community/menu", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  function MenuView({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return <View {...props}>{children}</View>;
  }

  return { MenuView };
});

const mockUseQuery = jest.fn((_input: unknown, _options?: unknown) => ({
  data: {
    group: {
      id: "group-1",
      name: "Lisbon",
      color: "#1764B0",
      currency: "EUR" as const,
    },
    range: "all" as const,
    unconvertedExpenseCount: 0,
    totalSpent: { currency: "EUR" as const, minor: "19000" },
    viewerPaid: { currency: "EUR" as const, minor: "11000" },
    viewerShare: { currency: "EUR" as const, minor: "7000" },
    expenseCount: 3,
    rangeStart: new Date("2026-07-01T00:00:00.000Z"),
    rangeEnd: new Date("2026-08-31T23:59:59.999Z"),
    timelineBucket: "month" as "day" | "week" | "month" | "year",
    categories: [
      {
        iconKey: "dining" as const,
        amount: { currency: "EUR" as const, minor: "12000" },
      },
      {
        iconKey: "transport" as const,
        amount: { currency: "EUR" as const, minor: "6000" },
      },
      {
        iconKey: "other" as const,
        amount: { currency: "EUR" as const, minor: "1000" },
      },
    ],
    timeline: [
      {
        period: "2026-07",
        amount: { currency: "EUR" as const, minor: "13000" },
      },
      {
        period: "2026-08",
        amount: { currency: "EUR" as const, minor: "6000" },
      },
    ],
    members: [
      {
        userId: "viewer",
        displayName: "Lasse",
        avatarUrl: null,
        homeCurrency: "EUR" as const,
        isViewer: true,
        paid: { currency: "EUR" as const, minor: "11000" },
        share: { currency: "EUR" as const, minor: "7000" },
      },
      {
        userId: "alex",
        displayName: "Alex",
        avatarUrl: null,
        homeCurrency: "USD" as const,
        isViewer: false,
        paid: { currency: "EUR" as const, minor: "8000" },
        share: { currency: "EUR" as const, minor: "12000" },
      },
    ],
    expenses: [
      {
        id: "expense-3",
        description: "Mystery purchase",
        iconKey: "other" as const,
        occurredAt: new Date("2026-07-22T18:00:00.000Z"),
        amount: { currency: "EUR" as const, minor: "1000" },
        sourceAmount: { currency: "EUR" as const, minor: "1000" },
        payments: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
            sourceAmount: { currency: "EUR" as const, minor: "1000" },
            homeAmount: { currency: "USD" as const, minor: "1100" },
          },
        ],
        shares: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
            sourceAmount: { currency: "EUR" as const, minor: "1000" },
            homeAmount: { currency: "USD" as const, minor: "1100" },
          },
        ],
      },
      {
        id: "expense-2",
        description: "Train",
        iconKey: "transport" as const,
        occurredAt: new Date("2026-08-01T09:00:00.000Z"),
        amount: { currency: "EUR" as const, minor: "6000" },
        sourceAmount: { currency: "EUR" as const, minor: "6000" },
        payments: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "6000" },
            sourceAmount: { currency: "EUR" as const, minor: "6000" },
            homeAmount: { currency: "USD" as const, minor: "6600" },
          },
        ],
        shares: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "3000" },
            sourceAmount: { currency: "EUR" as const, minor: "3000" },
            homeAmount: { currency: "EUR" as const, minor: "3000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "3000" },
            sourceAmount: { currency: "EUR" as const, minor: "3000" },
            homeAmount: { currency: "USD" as const, minor: "3300" },
          },
        ],
      },
      {
        id: "expense-1",
        description: "Dinner",
        iconKey: "dining" as const,
        occurredAt: new Date("2026-07-20T18:00:00.000Z"),
        amount: { currency: "EUR" as const, minor: "12000" },
        sourceAmount: { currency: "USD" as const, minor: "13000" },
        payments: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "11000" },
            sourceAmount: { currency: "USD" as const, minor: "11917" },
            homeAmount: { currency: "EUR" as const, minor: "11000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
            sourceAmount: { currency: "USD" as const, minor: "1083" },
            homeAmount: { currency: "USD" as const, minor: "1083" },
          },
        ],
        shares: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "4000" },
            sourceAmount: { currency: "USD" as const, minor: "4333" },
            homeAmount: { currency: "EUR" as const, minor: "4000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "8000" },
            sourceAmount: { currency: "USD" as const, minor: "8667" },
            homeAmount: { currency: "USD" as const, minor: "8667" },
          },
        ],
      },
    ],
  },
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: jest.fn(),
}));
const defaultUseQueryImplementation = mockUseQuery.getMockImplementation()!;

jest.mock("../lib/trpc", () => ({
  api: {
    groups: {
      statistics: {
        useQuery: (input: unknown, options?: unknown) =>
          mockUseQuery(input, options),
      },
    },
  },
}));

const GroupStatisticsScreen =
  require("../app/(tabs)/groups/[id]/statistics").default as React.ComponentType;
const StatisticsExpensesScreen =
  require("../app/(tabs)/groups/[id]/statistics-expenses")
    .default as React.ComponentType;

const mockPush = (
  jest.requireMock("expo-router") as { router: { push: jest.Mock } }
).router.push;

describe("group statistics", () => {
  beforeEach(() => {
    mockUseQuery.mockImplementation(defaultUseQueryImplementation);
    mockPush.mockClear();
    mockUseQuery.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: "group-1" });
  });

  it("visualizes how personal, category, and member amounts relate", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    const hero = view.getByTestId("statistics-hero");
    const heroStyle = StyleSheet.flatten(hero.props.style);
    expect(heroStyle.backgroundColor).not.toBe("#1764B0");
    expect(heroStyle.minHeight).toBe(108);
    expect(within(hero).getAllByText("70.00 €").length).toBeGreaterThan(0);
    const heroAmount = within(hero).getAllByText("70.00 €")[0];
    expect(heroAmount?.props.adjustsFontSizeToFit).toBeUndefined();
    expect(StyleSheet.flatten(heroAmount?.props.style).fontSize).toBe(38);
    expect(within(hero).getAllByText("Your share").length).toBeGreaterThan(0);
    expect(within(hero).getByText("37% of 190.00 € total")).toBeTruthy();
    const paymentSummary = within(hero).getByTestId("viewer-payment-summary");
    expect(within(paymentSummary).getByText("You paid")).toBeTruthy();
    expect(within(paymentSummary).getByText("110.00 €")).toBeTruthy();
    expect(
      within(paymentSummary).getByText("40.00 € more than your share"),
    ).toBeTruthy();
    expect(view.queryByTestId("viewer-paid-bar")).toBeNull();
    expect(view.queryByTestId("viewer-share-bar")).toBeNull();
    expect(
      StyleSheet.flatten(view.getByTestId("viewer-share-segment").props.style)
        .width,
    ).toBe("37%");
    expect(view.queryByText("All recorded expenses")).toBeNull();
    expect(within(hero).queryByText("Total group spending")).toBeNull();
    expect(view.getAllByText(/190.00 €/).length).toBeGreaterThan(0);
    expect(view.getByText("You paid")).toBeTruthy();
    expect(view.getAllByText("Your share").length).toBeGreaterThan(0);
    expect(view.getByText("Spending over time")).toBeTruthy();
    const timelineScroll = view.getByTestId("statistics-timeline-scroll");
    expect(timelineScroll.props.horizontal).toBe(true);
    expect(
      StyleSheet.flatten(timelineScroll.props.contentContainerStyle),
    ).toMatchObject({ minWidth: "100%", justifyContent: "flex-end" });
    expect(
      timelineScroll.props.onContentSizeChange,
    ).toEqual(expect.any(Function));
    expect(view.getByText("Latest total")).toBeTruthy();
    expect(view.getByText("Aug 2026 · 60.00 €")).toBeTruthy();
    expect(view.getByText("Monthly totals · adapts to your timeframe")).toBeTruthy();
    expect(view.getByText("Tap a bar to see its exact total")).toBeTruthy();
    await fireEvent.press(view.getByTestId("timeline-bar-2026-08"));
    expect(view.getByText("Selected total")).toBeTruthy();
    expect(view.getByText("Aug 2026 · 60.00 €")).toBeTruthy();
    expect(view.getByText("Where the money went")).toBeTruthy();
    expect(view.getByText("Spending by member")).toBeTruthy();
    expect(
      view.getByText("Ranked by share · initial payments shown for context"),
    ).toBeTruthy();
    const memberSortMenu = view.getByTestId("member-sort-menu");
    const memberSortButton = view.getByTestId("member-sort-button");
    expect(StyleSheet.flatten(memberSortButton.props.style)).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 18,
    });
    expect(view.queryByText("Sort")).toBeNull();
    expect(memberSortMenu.props.actions).toEqual([
      { id: "share", title: "Share", state: "on" },
      { id: "paid", title: "Paid", state: "off" },
      { id: "name", title: "Name", state: "off" },
    ]);
    expect(view.getByText("Uncategorized")).toBeTruthy();
    expect(
      StyleSheet.flatten(
        view.getByTestId("category-segment-dining").props.style,
      ).width,
    ).toBe("63%");
    expect(
      StyleSheet.flatten(
        view.getByTestId("category-segment-dining").props.style,
      ).backgroundColor,
    ).toBe(semanticChartColorFor("expense:dining", "light"));
    expect(
      StyleSheet.flatten(
        view.getByTestId("category-segment-transport").props.style,
      ).width,
    ).toBe("32%");
    const rangeControl = view.getByTestId("statistics-range-control");
    expect(rangeControl.props.values).toEqual([
      "All time",
      "30 days",
      "1 year",
      "Custom",
    ]);
    expect(rangeControl.props.selectedIndex).toBe(0);
    expect(StyleSheet.flatten(rangeControl.props.style).width).toBe("100%");
    expect(view.queryByText("TIME PERIOD")).toBeNull();
    expect(view.queryByText("Everything")).toBeNull();

    expect(
      view
        .getAllByLabelText(/Show expenses where/)
        .map((row) => row.props.accessibilityLabel),
    ).toEqual([
      "Show expenses where Alex had a share",
      "Show expenses where Alex paid",
      "Show expenses where you had a share",
      "Show expenses where you paid",
    ]);

    await fireEvent(memberSortMenu, "pressAction", {
      nativeEvent: { event: "paid" },
    });
    expect(
      view.getByText("Ranked by paid amount · shares shown for context"),
    ).toBeTruthy();
    expect(
      view
        .getAllByLabelText(/Show expenses where/)
        .map((row) => row.props.accessibilityLabel),
    ).toEqual([
      "Show expenses where you had a share",
      "Show expenses where you paid",
      "Show expenses where Alex had a share",
      "Show expenses where Alex paid",
    ]);
    await fireEvent(view.getByTestId("member-sort-menu"), "pressAction", {
      nativeEvent: { event: "share" },
    });

    expect(view.getByText("Paid 40.00 € less")).toBeTruthy();
    expect(view.getByText("Paid 40.00 € more")).toBeTruthy();
    expect(
      StyleSheet.flatten(view.getByTestId("member-share-amount-alex").props.style)
        .fontSize,
    ).toBe(18);
    expect(
      StyleSheet.flatten(view.getByTestId("member-paid-amount-alex").props.style)
        .fontSize,
    ).toBe(12);
    expect(
      StyleSheet.flatten(view.getByTestId("member-share-track-alex").props.style)
        .height,
    ).toBe(8);
    expect(
      StyleSheet.flatten(view.getByTestId("member-paid-track-alex").props.style)
        .height,
    ).toBe(3);
    await fireEvent.press(
      view.getByLabelText("Show expenses where Alex had a share"),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/groups/[id]/statistics-expenses",
      params: {
        id: "group-1",
        range: "all",
        filter: "member",
        userId: "alex",
        metric: "share",
      },
    });
    mockPush.mockClear();

    await fireEvent.press(view.getByLabelText("Show expenses where Alex paid"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/groups/[id]/statistics-expenses",
      params: {
        id: "group-1",
        range: "all",
        filter: "member",
        userId: "alex",
        metric: "paid",
      },
    });
    mockPush.mockClear();

    await fireEvent.press(view.getByLabelText("Show Uncategorized expenses"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/groups/[id]/statistics-expenses",
      params: {
        id: "group-1",
        range: "all",
        filter: "category",
        category: "other",
      },
    });

    await fireEvent(rangeControl, "change", {
      nativeEvent: { selectedSegmentIndex: 2, value: "1 year" },
    });
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      {
        groupId: "group-1",
        range: "12-months",
      },
      { placeholderData: expect.any(Function) },
    );
    expect(view.getByTestId("statistics-range-control").props.selectedIndex).toBe(
      2,
    );
  });

  it("fills short-range charts with tappable daily totals", async () => {
    mockUseQuery.mockImplementation((input, options) => {
      const result = defaultUseQueryImplementation(input, options);
      return {
        ...result,
        data: {
          ...result.data,
          rangeStart: new Date("2026-08-01T00:00:00.000Z"),
          rangeEnd: new Date("2026-08-05T23:59:59.999Z"),
          timelineBucket: "day" as const,
          timeline: [
            {
              period: "2026-08-01",
              amount: { currency: "EUR" as const, minor: "13000" },
            },
            {
              period: "2026-08-03",
              amount: { currency: "EUR" as const, minor: "6000" },
            },
          ],
        },
      };
    });
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("Daily totals · adapts to your timeframe")).toBeTruthy();
    expect(view.getByText(/Aug 3, 2026 · 60.00 €/)).toBeTruthy();
    expect(view.queryByTestId("timeline-bar-2026-08-04")).toBeNull();
    expect(view.queryByTestId("timeline-bar-2026-08-05")).toBeNull();
    const emptyDay = view.getByTestId("timeline-bar-2026-08-02");
    expect(emptyDay.props.accessibilityLabel).toMatch(/total, 0.00 €/);
    await fireEvent.press(emptyDay);
    expect(view.getByText("Selected total")).toBeTruthy();
    expect(view.getByText(/Aug 2, 2026 · 0.00 €/)).toBeTruthy();
  });

  it("scales share and paid member bars against separate maxima", async () => {
    mockUseQuery.mockImplementation((input, options) => {
      const result = defaultUseQueryImplementation(input, options);
      return {
        ...result,
        data: {
          ...result.data,
          members: [
            {
              ...result.data.members[0]!,
              paid: { currency: "EUR" as const, minor: "5000" },
              share: { currency: "EUR" as const, minor: "12000" },
            },
            {
              ...result.data.members[1]!,
              paid: { currency: "EUR" as const, minor: "6000" },
              share: { currency: "EUR" as const, minor: "7000" },
            },
          ],
        },
      };
    });

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(
      StyleSheet.flatten(
        view.getByTestId("member-share-fill-viewer").props.style,
      ).width,
    ).toBe("100%");
    expect(
      StyleSheet.flatten(
        view.getByTestId("member-share-fill-alex").props.style,
      ).width,
    ).toBe("58%");
    expect(
      StyleSheet.flatten(
        view.getByTestId("member-paid-fill-alex").props.style,
      ).width,
    ).toBe("100%");
    expect(
      StyleSheet.flatten(
        view.getByTestId("member-paid-fill-viewer").props.style,
      ).width,
    ).toBe("83%");
  });

  it("keeps automatic range reloads out of the pull-to-refresh control", async () => {
    mockUseQuery.mockImplementation((input, options) => ({
      ...defaultUseQueryImplementation(input, options),
      isRefetching: true,
    }));

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    let screen = view.getByTestId("statistics-range-selector").parent;
    while (screen && !screen.props.refreshControl) screen = screen.parent;
    expect(screen?.props.refreshControl.props.refreshing).toBe(false);
  });

  it("applies exact custom dates and keeps them in drill-down links", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    await fireEvent(view.getByTestId("statistics-range-control"), "change", {
      nativeEvent: { selectedSegmentIndex: 3, value: "Custom" },
    });
    expect(view.getByTestId("statistics-custom-range-editor")).toBeTruthy();
    expect(view.getByTestId("statistics-range-control").props.selectedIndex).toBe(
      3,
    );
    expect(view.queryByTestId("statistics-custom-date-picker")).toBeNull();
    expect(view.getByTestId("statistics-custom-from-picker")).toBeTruthy();
    expect(view.getByTestId("statistics-custom-to-picker")).toBeTruthy();

    const fromDate = new Date(2026, 5, 2, 12);
    await fireEvent(
      view.getByTestId("statistics-custom-from-picker"),
      "dateChange",
      { nativeEvent: { date: fromDate } },
    );
    const toDate = new Date(2026, 6, 18, 12);
    await fireEvent(
      view.getByTestId("statistics-custom-to-picker"),
      "dateChange",
      { nativeEvent: { date: toDate } },
    );

    const expectedFrom = new Date(2026, 5, 2, 0, 0, 0, 0);
    const expectedTo = new Date(2026, 6, 18, 23, 59, 59, 999);
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      {
        groupId: "group-1",
        range: "custom",
        from: expectedFrom,
        to: expectedTo,
      },
      { placeholderData: expect.any(Function) },
    );
    expect(view.getByTestId("statistics-range-control").props.selectedIndex).toBe(
      3,
    );
    expect(view.getByText("From")).toBeTruthy();
    expect(view.getByText("To")).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Show Uncategorized expenses"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/groups/[id]/statistics-expenses",
      params: {
        id: "group-1",
        range: "custom",
        from: expectedFrom.toISOString(),
        to: expectedTo.toISOString(),
        filter: "category",
        category: "other",
      },
    });
  });

  it("lists every expense in a selected category, including uncategorized", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      id: "group-1",
      range: "all",
      filter: "category",
      category: "other",
    });
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <StatisticsExpensesScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("Mystery purchase")).toBeTruthy();
    expect(view.getByText("1 expense · 10.00 €")).toBeTruthy();
    expect(view.queryByText("Dinner")).toBeNull();
    expect(view.queryByText("Train")).toBeNull();
    await fireEvent.press(view.getByText("Mystery purchase"));
    expect(mockPush).toHaveBeenCalledWith("/expense/expense-3");
  });

  it("reuses custom dates on a statistics expense drill-down", async () => {
    const from = new Date("2026-06-02T00:00:00.000Z");
    const to = new Date("2026-07-18T21:59:59.999Z");
    mockUseLocalSearchParams.mockReturnValue({
      id: "group-1",
      range: "custom",
      from: from.toISOString(),
      to: to.toISOString(),
      filter: "category",
      category: "other",
    });
    await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <StatisticsExpensesScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(mockUseQuery).toHaveBeenLastCalledWith(
      {
        groupId: "group-1",
        range: "custom",
        from,
        to,
      },
      undefined,
    );
  });

  it("filters member expenses by the selected paid model", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      id: "group-1",
      range: "all",
      filter: "member",
      userId: "viewer",
      metric: "paid",
    });
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <StatisticsExpensesScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("Dinner")).toBeTruthy();
    expect(view.getByText("1 expense · 110.00 €")).toBeTruthy();
    expect(view.queryByText(/Amounts on the right show/)).toBeNull();
    expect(view.getByText("$130.00 total · 2 people")).toBeTruthy();
    expect(view.getByText("$119.17")).toBeTruthy();
    expect(view.getByText("110.00 €")).toBeTruthy();
    expect(view.queryByText("Paid")).toBeNull();
    expect(view.queryByText("Train")).toBeNull();
    expect(view.queryByText("Mystery purchase")).toBeNull();
  });

  it("shows member shares in source and home currencies", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      id: "group-1",
      range: "all",
      filter: "member",
      userId: "viewer",
      metric: "share",
    });
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <StatisticsExpensesScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("2 expenses · 70.00 €")).toBeTruthy();
    expect(view.getByText("Where your share went")).toBeTruthy();
    expect(view.getByText("Only your portion of each expense")).toBeTruthy();
    expect(view.getByText("Dining")).toBeTruthy();
    expect(view.getByText("Transport")).toBeTruthy();
    expect(view.getByText("57%")).toBeTruthy();
    expect(view.getByText("43%")).toBeTruthy();
    expect(
      StyleSheet.flatten(
        view.getByTestId("category-segment-dining").props.style,
      ).backgroundColor,
    ).toBe(semanticChartColorFor("expense:dining", "light"));
    expect(
      StyleSheet.flatten(
        view.getByTestId("category-segment-transport").props.style,
      ).backgroundColor,
    ).toBe(semanticChartColorFor("expense:transport", "light"));
    expect(view.queryByText(/Amounts on the right show/)).toBeNull();
    expect(view.getByText("$130.00 total · 2 people")).toBeTruthy();
    expect(view.getByText("60.00 € total · 2 people")).toBeTruthy();
    expect(view.getByText("$43.33")).toBeTruthy();
    expect(view.getAllByText("40.00 €").length).toBeGreaterThan(0);
    expect(view.queryByText("Share")).toBeNull();
  });

  it("keeps your share visible when the selected period changes", async () => {
    mockUseQuery.mockImplementation((input, options) => {
      const result = defaultUseQueryImplementation(input, options);
      const range = (input as { range?: string }).range;
      return {
        ...result,
        data: {
          ...result.data,
          viewerShare:
            range === "12-months"
              ? { currency: "EUR" as const, minor: "2500" }
              : result.data.viewerShare,
        },
      };
    });

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupStatisticsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(
      within(view.getByTestId("statistics-hero")).getAllByText("70.00 €")
        .length,
    ).toBeGreaterThan(0);

    await fireEvent(view.getByTestId("statistics-range-control"), "change", {
      nativeEvent: { selectedSegmentIndex: 2, value: "1 year" },
    });

    const updatedHero = view.getByTestId("statistics-hero");
    expect(within(updatedHero).getAllByText("Your share").length).toBeGreaterThan(
      0,
    );
    expect(within(updatedHero).getAllByText("25.00 €").length).toBeGreaterThan(
      0,
    );
    expect(view.queryByText("Last 30 days")).toBeNull();
  });
});
