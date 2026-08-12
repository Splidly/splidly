import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

const mockUseLocalSearchParams = jest.fn(
  (): {
    id: string;
    range?: string;
    filter?: string;
    category?: string;
    userId?: string;
    metric?: string;
  } => ({ id: "group-1" }),
);

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Stack: { Screen: () => null },
}));

jest.mock("@expo/ui/community/segmented-control", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text, View } =
    require("react-native") as typeof import("react-native");

  function SegmentedControl({
    values = [],
    selectedIndex = 0,
    onChange,
    testID,
  }: {
    values?: string[];
    selectedIndex?: number;
    onChange?: (event: {
      nativeEvent: { selectedSegmentIndex: number; value: string };
    }) => void;
    testID?: string;
  }) {
    return (
      <View accessibilityRole="tablist" testID={testID}>
        {values.map((value, index) => (
          <Pressable
            key={value}
            testID={`${testID}-${index}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: index === selectedIndex }}
            onPress={() =>
              onChange?.({
                nativeEvent: { selectedSegmentIndex: index, value },
              })
            }
          >
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return { __esModule: true, default: SegmentedControl, SegmentedControl };
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
        isViewer: true,
        paid: { currency: "EUR" as const, minor: "11000" },
        share: { currency: "EUR" as const, minor: "7000" },
      },
      {
        userId: "alex",
        displayName: "Alex",
        avatarUrl: null,
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
        payments: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
          },
        ],
        shares: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
          },
        ],
      },
      {
        id: "expense-2",
        description: "Train",
        iconKey: "transport" as const,
        occurredAt: new Date("2026-08-01T09:00:00.000Z"),
        amount: { currency: "EUR" as const, minor: "6000" },
        payments: [
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "6000" },
          },
        ],
        shares: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "3000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "3000" },
          },
        ],
      },
      {
        id: "expense-1",
        description: "Dinner",
        iconKey: "dining" as const,
        occurredAt: new Date("2026-07-20T18:00:00.000Z"),
        amount: { currency: "EUR" as const, minor: "12000" },
        payments: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "11000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "1000" },
          },
        ],
        shares: [
          {
            userId: "viewer",
            amount: { currency: "EUR" as const, minor: "4000" },
          },
          {
            userId: "alex",
            amount: { currency: "EUR" as const, minor: "8000" },
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

  it("shows paid and share separately and supports comparison controls", async () => {
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
    expect(within(hero).getByText("70.00 €")).toBeTruthy();
    expect(within(hero).getByText("Your share")).toBeTruthy();
    expect(view.queryByText("All recorded expenses")).toBeNull();
    expect(within(hero).queryByText("Total group spending")).toBeNull();
    expect(view.getByText("190.00 €")).toBeTruthy();
    expect(view.getByText("Total group spending")).toBeTruthy();
    expect(view.getByText("You paid")).toBeTruthy();
    expect(view.getByText("Your share")).toBeTruthy();
    expect(view.queryByText(/fronted|covered|you owe/i)).toBeNull();
    expect(view.getByText("Spending over time")).toBeTruthy();
    expect(view.getByText("Where the money went")).toBeTruthy();
    expect(view.getByText("Group members")).toBeTruthy();
    expect(view.queryByText("Highlights")).toBeNull();
    expect(view.getByText("Uncategorized")).toBeTruthy();
    expect(
      view.getByTestId("statistics-range-0").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      view.getByTestId("member-metric-0").props.accessibilityState,
    ).toEqual({ selected: true });

    expect(
      view
        .getAllByLabelText(/Show expenses where/)
        .map((row) => row.props.accessibilityLabel),
    ).toEqual([
      "Show expenses where Alex had a share",
      "Show expenses where you had a share",
    ]);

    expect(view.getAllByText("120.00 €").length).toBeGreaterThan(0);
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

    await fireEvent.press(view.getByText("Paid"));
    expect(
      view.getByTestId("member-metric-1").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      view
        .getAllByLabelText(/Show expenses where/)
        .map((row) => row.props.accessibilityLabel),
    ).toEqual([
      "Show expenses where Alex paid",
      "Show expenses where you paid",
    ]);
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

    await fireEvent.press(view.getByText("30 days"));
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      {
        groupId: "group-1",
        range: "30-days",
      },
      { placeholderData: expect.any(Function) },
    );
    expect(
      view.getByTestId("statistics-range-2").props.accessibilityState,
    ).toEqual({ selected: true });
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
    expect(
      view.getByText(
        "Amounts on the right show what you paid, not the full expense total.",
      ),
    ).toBeTruthy();
    expect(view.queryByText("Train")).toBeNull();
    expect(view.queryByText("Mystery purchase")).toBeNull();
  });

  it("clarifies that member share amounts are not expense totals", async () => {
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
    expect(
      view.getByText(
        "Amounts on the right show your share, not the full expense total.",
      ),
    ).toBeTruthy();
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
            range === "30-days"
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

    expect(within(view.getByTestId("statistics-hero")).getByText("70.00 €"))
      .toBeTruthy();

    await fireEvent.press(view.getByText("30 days"));

    const updatedHero = view.getByTestId("statistics-hero");
    expect(within(updatedHero).getByText("Your share")).toBeTruthy();
    expect(within(updatedHero).getByText("25.00 €")).toBeTruthy();
    expect(view.queryByText("Last 30 days")).toBeNull();
  });
});
