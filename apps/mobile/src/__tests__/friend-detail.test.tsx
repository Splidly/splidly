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

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: "friendship-1" }),
  Stack: { Screen: () => null },
}));

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
    jest.clearAllMocks();
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
    expect(view.getByText("No expenses yet")).toBeTruthy();
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
