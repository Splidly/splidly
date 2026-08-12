import { fireEvent, render } from "@testing-library/react-native";
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements/Header/HeaderHeightContext";
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

jest.mock("../lib/trpc", () => ({
  api: {
    groups: {
      detail: {
        useQuery: () => ({
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
        }),
      },
    },
  },
}));

const mockPush = (
  jest.requireMock("expo-router") as {
    router: { push: jest.Mock };
  }
).router.push;

describe("GroupDetailScreen actions", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("opens one settle-up sheet instead of rendering balance actions", async () => {
    const view = await render(
      <HeaderHeightContext.Provider value={100}>
        <SafeAreaInsetsContext.Provider
          value={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <GroupDetailScreen />
        </SafeAreaInsetsContext.Provider>
      </HeaderHeightContext.Provider>,
    );

    expect(view.getByLabelText("You owe Alex 12.34 €")).toBeTruthy();
    expect(view.getByText(/Alex paid \$10\.00$/)).toBeTruthy();
    expect(view.getByText("You owe")).toBeTruthy();
    expect(view.getByText("3.40 €")).toBeTruthy();
    expect(view.getByText(/You \+ Alex paid 24\.00 €$/)).toBeTruthy();
    expect(view.getByText("You lent")).toBeTruthy();
    expect(view.getByText("10.00 €")).toBeTruthy();
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
    await fireEvent(view.getByTestId("group-identity-header"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 58 } },
    });
    const [groupScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!groupScrollView) throw new Error("Group ScrollView was not rendered");
    await fireEvent.scroll(groupScrollView, {
      nativeEvent: {
        contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
        contentOffset: { x: 0, y: -42 },
        contentSize: { width: 300, height: 900 },
        layoutMeasurement: { width: 300, height: 700 },
        zoomScale: 1,
      },
    });
    expect(view.getByTestId("group-navigation-title").props.children).toBe(
      "Lisbon",
    );
    await fireEvent.scroll(groupScrollView, {
      nativeEvent: {
        contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
        contentOffset: { x: 0, y: -100 },
        contentSize: { width: 300, height: 900 },
        layoutMeasurement: { width: 300, height: 700 },
        zoomScale: 1,
      },
    });
    expect(view.getByTestId("group-navigation-title").props.children).toBe("");
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
    await fireEvent.press(view.getByText("Settle up"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement/group",
      params: { id: "group-1" },
    });
  });
});
