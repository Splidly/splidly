import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupDetailScreen from "../app/(tabs)/groups/[id]";

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = ({ options }: { options?: { title?: string } }) => {
    const { Text } = require("react-native") as typeof import("react-native");
    return <Text testID="group-navigation-title">{options?.title ?? ""}</Text>;
  };
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => {
    const { Pressable, Text } =
      require("react-native") as typeof import("react-native");
    return (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Text>{accessibilityLabel}</Text>
      </Pressable>
    );
  };
  return {
    router: {
      push: jest.fn(),
    },
    useLocalSearchParams: () => ({ id: "group-1" }),
    Stack: {
      Screen,
      Toolbar,
    },
  };
});

jest.mock("../lib/use-delete-activity-expense", () => ({
  useDeleteActivityExpense: () => ({
    confirmDelete: jest.fn(),
    isPending: false,
  }),
}));

jest.mock("../lib/trpc", () => ({
  api: {
    groups: {
      detail: {
        useQuery: jest.fn(() => ({
          data: {
            group: {
              id: "group-1",
              name: "Lisbon",
              iconKey: "trip",
              color: "#1764B0",
              currency: "EUR",
            },
            members: [
              {
                userId: "user-1",
                displayName: "Lasse",
                homeCurrency: "EUR",
              },
              {
                userId: "user-2",
                displayName: "Alex",
                homeCurrency: "USD",
              },
            ],
            memberBalances: [
              {
                userId: "user-2",
                displayName: "Alex",
                balance: { currency: "EUR", minor: "-1234" },
              },
            ],
            settlements: [
              {
                id: "settlement-1",
                occurredAt: new Date("2026-07-21T12:00:00.000Z"),
                notes: "",
                amount: { currency: "EUR", minor: "600" },
                from: {
                  userId: "user-2",
                  displayName: "Alex",
                  avatarUrl: null,
                  isViewer: false,
                },
                to: {
                  userId: "user-1",
                  displayName: "Lasse",
                  avatarUrl: null,
                  isViewer: true,
                },
              },
            ],
            expenses: [
              {
                id: "expense-1",
                description: "Dinner",
                occurredAt: new Date("2026-07-20T12:00:00.000Z"),
                sourceCurrency: "USD",
                sourceAmountMinor: 1_000n,
                canonicalAmount: { currency: "EUR", minor: "850" },
                payers: [
                  {
                    userId: "user-2",
                    displayName: "Alex",
                    isViewer: false,
                  },
                ],
                paymentTotal: { currency: "USD", minor: "1000" },
                viewerInvolvement: {
                  kind: "borrowed",
                  amount: { currency: "EUR", minor: "340" },
                },
                iconKey: "food",
                iconManuallySet: true,
              },
              {
                id: "expense-2",
                description: "Taxi",
                occurredAt: new Date("2026-07-20T18:00:00.000Z"),
                sourceCurrency: "EUR",
                sourceAmountMinor: 2_400n,
                canonicalAmount: { currency: "EUR", minor: "2400" },
                payers: [
                  {
                    userId: "user-1",
                    displayName: "Lasse",
                    isViewer: true,
                  },
                  {
                    userId: "user-2",
                    displayName: "Alex",
                    isViewer: false,
                  },
                ],
                paymentTotal: { currency: "EUR", minor: "2400" },
                viewerInvolvement: {
                  kind: "lent",
                  amount: { currency: "EUR", minor: "1000" },
                },
                iconKey: "transport",
                iconManuallySet: true,
              },
            ],
          },
          error: null,
          isPending: false,
        })),
      },
    },
  },
}));

const mockPush = (
  jest.requireMock("expo-router") as {
    router: { push: jest.Mock };
  }
).router.push;
const mockDetailQuery = (
  jest.requireMock("../lib/trpc") as {
    api: { groups: { detail: { useQuery: jest.Mock } } };
  }
).api.groups.detail.useQuery;

describe("GroupDetailScreen actions", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockDetailQuery.mockClear();
  });

  it("opens an expense only once on rapid repeated taps", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    await fireEvent(view.getByTestId("activity-expense-Dinner"), "buttonPress");
    await fireEvent(view.getByTestId("activity-expense-Dinner"), "buttonPress");
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/expense/expense-1");
  });

  it("opens one settle-up sheet instead of rendering balance actions", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByLabelText("You owe Alex 12.34 €")).toBeTruthy();
    expect(nativeText(view, /Alex paid \$10\.00$/)).toBeTruthy();
    expect(nativeText(view, "You owe")).toBeTruthy();
    expect(nativeText(view, "3.40 €")).toBeTruthy();
    expect(nativeText(view, /You \+ Alex paid 24\.00 €$/)).toBeTruthy();
    expect(nativeText(view, "You lent")).toBeTruthy();
    expect(nativeText(view, "10.00 €")).toBeTruthy();
    expect(view.getByText("Payment")).toBeTruthy();
    expect(view.getByTestId("settlement-activity-row")).toBeTruthy();
    expect(view.getByLabelText("Payment. Alex paid you 6.00 €")).toBeTruthy();
    expect(view.getByText("Alex paid you 6.00 €")).toBeTruthy();
    expect(view.queryByText("You received")).toBeNull();
    expect(view.queryByText("6.00 €")).toBeNull();
    expect(
      view.getAllByTestId(/^activity-date-\d{4}-\d{2}-\d{2}$/),
    ).toHaveLength(2);
    expect(view.getByTestId("activity-date-2026-07-20")).toBeTruthy();
    expect(view.queryByText("Activity")).toBeNull();
    expect(
      StyleSheet.flatten(
        view.getByTestId("activity-date-label-2026-07-20").props.style,
      ).fontSize,
    ).toBe(14);
    expect(view.queryByText(/20 Jul ·/)).toBeNull();
    expect(view.queryByText("Open balances")).toBeNull();
    expect(view.getByLabelText("Lisbon statistics")).toBeTruthy();
    expect(view.getByTestId("group-navigation-title").props.children).toBe("");
    expect(
      view.getByTestId("native-activity-list").props.onScroll,
    ).toBeUndefined();
    await fireEvent.press(view.getByLabelText("Lisbon members and balances"));
    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/settings");
    mockPush.mockClear();
    await fireEvent.press(view.getByLabelText("Lisbon settings"));
    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/settings");
    mockPush.mockClear();
    await fireEvent.press(view.getByLabelText("Lisbon statistics"));
    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/statistics");
    mockPush.mockClear();
    await fireEvent.press(view.getByTestId("settlement-activity-row"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "group",
        id: "group-1",
        canonicalCurrency: "EUR",
        settlementId: "settlement-1",
      },
    });
    mockPush.mockClear();
    expect(
      StyleSheet.flatten(view.getByText("Add expense").props.style).textAlign,
    ).toBe("center");
    expect(
      StyleSheet.flatten(view.getByText("Settle up").props.style).textAlign,
    ).toBe("center");
    await fireEvent.press(view.getByText("Settle up"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement/group",
      params: { id: "group-1" },
    });
  });

  it("keeps the overview separate from the empty state when activity disappears and returns", async () => {
    const populated = mockDetailQuery();
    const empty = {
      ...populated,
      data: { ...populated.data, expenses: [], settlements: [] },
    };
    const content = () => (
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupDetailScreen />
      </SafeAreaInsetsContext.Provider>
    );
    const view = await render(content());
    const overview = view.getByTestId("native-activity-header-content");
    await fireEvent(view.getByTestId("native-activity-list"), "hostedLayout", {
      nativeEvent: { key: "header:overview", width: 320 },
    });
    await fireEvent(overview, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 236 } },
    });
    mockDetailQuery.mockReturnValueOnce(empty);
    await view.rerender(content());
    expect(view.getByTestId("native-activity-header-content")).toBe(overview);
    expect(
      view.getByTestId("native-activity-list").props.sections[0].headerHeight,
    ).toBe(236);
    expect(
      view
        .getByTestId("native-activity-footer-content")
        .queryAll((node) => node.props.children === "No activity yet"),
    ).toHaveLength(1);
    expect(
      overview.queryAll((node) => node.props.children === "No activity yet"),
    ).toHaveLength(0);
    await view.rerender(content());
    expect(view.queryByText("No activity yet")).toBeNull();
    expect(view.getByTestId("native-activity-header-content")).toBe(overview);
    expect(view.getByTestId("activity-date-2026-07-20")).toBeTruthy();
    expect(view.getByTestId("group-navigation-title").props.children).toBe("");
  });
});

function nativeText(
  view: Awaited<ReturnType<typeof render>>,
  text: string | RegExp,
) {
  const matches = view.container.queryAll(
    (node) =>
      typeof node.props.text === "string" &&
      (typeof text === "string"
        ? node.props.text === text
        : text.test(node.props.text)),
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}
