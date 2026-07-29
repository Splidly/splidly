import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupDetailScreen from "../app/(tabs)/groups/[id]";

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = () => null;
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
            expenses: [],
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

describe("GroupDetailScreen settlements", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("opens the settlement sheet with the signed group balance", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("You owe 12.34 EUR")).toBeTruthy();
    await fireEvent.press(view.getByText("Settle"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "group",
        id: "group-1",
        friendId: "user-2",
        canonicalCurrency: "EUR",
        canonicalMinor: "-1234",
      },
    });
  });
});
