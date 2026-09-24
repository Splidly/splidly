import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import FriendDetailScreen from "../app/(tabs)/friends/[id]";

let mockFriendExpenses: Array<{
  id: string;
  description: string;
  occurredAt: Date;
  sourceCurrency: string;
  sourceAmountMinor: bigint;
  iconKey: "food" | "transport";
  iconManuallySet: boolean;
}> = [];
let mockFriendSettlements: Array<{
  id: string;
  occurredAt: Date;
  createdAt: Date;
  canonicalCurrency: string;
  amount: { currency: string; minor: string };
  from: {
    userId: string;
    displayName: string;
    isViewer: boolean;
  };
  to: {
    userId: string;
    displayName: string;
    isViewer: boolean;
  };
}> = [];

jest.mock("expo-router", () => {
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    router: { push: jest.fn() },
    useLocalSearchParams: () => ({ id: "friendship-1" }),
    Stack: {
      Screen: ({ options }: { options?: { title?: string } }) => (
        <Text selectable={false} testID="friend-navigation-title">
          {options?.title ?? ""}
        </Text>
      ),
    },
  };
});

jest.mock("../lib/trpc", () => ({
  api: {
    profile: {
      me: {
        useQuery: () => ({
          data: {
            userId: "user-1",
            displayName: "You",
            homeCurrency: "EUR",
          },
          error: null,
          isPending: false,
        }),
      },
    },
    friends: {
      detail: {
        useQuery: () => ({
          data: {
            friend: {
              userId: "user-2",
              displayName: "Demo User",
              homeCurrency: "EUR",
            },
            expenses: mockFriendExpenses,
            settlements: mockFriendSettlements,
          },
          error: null,
          isPending: false,
        }),
      },
      list: {
        useQuery: () => ({
          data: [
            {
              friendship: { id: "friendship-1" },
              balances: [],
            },
          ],
          isPending: false,
        }),
      },
    },
  },
}));

describe("FriendDetailScreen", () => {
  beforeEach(() => {
    mockFriendExpenses = [];
    mockFriendSettlements = [];
    jest.clearAllMocks();
  });

  it("shows the navigation title only after the profile name scrolls away", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <FriendDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(view.getByTestId("friend-navigation-title").props.children).toBe("");
    await fireEvent(view.getByTestId("friend-identity-header"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } },
    });
    const [scrollView] = view.container.queryAll(
      (instance) => instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("Friend ScrollView was not rendered");
    const scroll = async (y: number) =>
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
          contentOffset: { x: 0, y },
          contentSize: { width: 300, height: 900 },
          layoutMeasurement: { width: 300, height: 700 },
          zoomScale: 1,
        },
      });
    await scroll(120);
    expect(view.getByTestId("friend-navigation-title").props.children).toBe(
      "Demo User",
    );
    await scroll(0);
    expect(view.getByTestId("friend-navigation-title").props.children).toBe("");
  });

  it("allows a payment even when there are no open balances", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <FriendDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.queryByText("You’re all settled")).toBeNull();
    expect(view.queryByText(/There are no open balances/)).toBeNull();
    await fireEvent.press(view.getByText("Record payment"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "friend",
        id: "friendship-1",
        friendshipId: "friendship-1",
        friendId: "user-2",
        fromUserId: "user-1",
        toUserId: "user-2",
        canonicalCurrency: "EUR",
      },
    });
    expect(view.getByText("No activity yet")).toBeTruthy();
  });

  it("shows direct payments in time order and opens them for editing", async () => {
    const occurredAt = new Date("2026-07-20T12:00:00.000Z");
    mockFriendExpenses = [
      {
        id: "expense-1",
        description: "Lunch",
        occurredAt,
        sourceCurrency: "EUR",
        sourceAmountMinor: 1_200n,
        iconKey: "food",
        iconManuallySet: true,
      },
    ];
    mockFriendSettlements = [
      {
        id: "settlement-1",
        occurredAt,
        createdAt: new Date("2026-07-20T15:00:00.000Z"),
        canonicalCurrency: "EUR",
        amount: { currency: "EUR", minor: "500" },
        from: {
          userId: "user-1",
          displayName: "You",
          isViewer: true,
        },
        to: {
          userId: "user-2",
          displayName: "Demo User",
          isViewer: false,
        },
      },
    ];

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <FriendDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("You paid Demo User 5.00 €")).toBeTruthy();
    await fireEvent.press(view.getByTestId("settlement-activity-row"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "friend",
        id: "friendship-1",
        friendshipId: "friendship-1",
        friendId: "user-2",
        canonicalCurrency: "EUR",
        settlementId: "settlement-1",
      },
    });
  });

  it("places direct expenses from the same date in one activity section", async () => {
    mockFriendExpenses = [
      {
        id: "expense-1",
        description: "Lunch",
        occurredAt: new Date("2026-07-20T12:00:00.000Z"),
        sourceCurrency: "EUR",
        sourceAmountMinor: 1_200n,
        iconKey: "food",
        iconManuallySet: true,
      },
      {
        id: "expense-2",
        description: "Taxi",
        occurredAt: new Date("2026-07-20T18:00:00.000Z"),
        sourceCurrency: "EUR",
        sourceAmountMinor: 2_000n,
        iconKey: "transport",
        iconManuallySet: true,
      },
    ];

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <FriendDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getAllByTestId(/^activity-date-\d/)).toHaveLength(1);
    expect(view.getByText("Lunch")).toBeTruthy();
    expect(view.getByText("Taxi")).toBeTruthy();
  });
});
