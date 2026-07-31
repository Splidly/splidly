import { render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import FriendDetailScreen from "../app/(tabs)/friends/[id]";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: "friendship-1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../lib/trpc", () => ({
  api: {
    friends: {
      detail: {
        useQuery: () => ({
          data: {
            friend: {
              userId: "user-2",
              displayName: "Demo User",
              homeCurrency: "EUR",
            },
            expenses: [],
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
  it("omits settlement UI when there are no open balances", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <FriendDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.queryByText("You’re all settled")).toBeNull();
    expect(view.queryByText(/There are no open balances/)).toBeNull();
    expect(view.getByText("No expenses yet")).toBeTruthy();
  });
});
