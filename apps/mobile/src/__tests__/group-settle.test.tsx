import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import SettleGroupScreen from "../app/settlement/group";

jest.mock("expo-router", () => ({
  router: {
    dismissTo: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "group-1" }),
}));

jest.mock("../lib/trpc", () => ({
  api: {
    profile: {
      me: {
        useQuery: () => ({
          data: {
            userId: "user-1",
            displayName: "Lasse",
            homeCurrency: "EUR",
          },
          error: null,
          isPending: false,
        }),
      },
    },
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
                homeCurrency: "EUR",
              },
              {
                userId: "user-3",
                displayName: "Flo",
                homeCurrency: "EUR",
              },
            ],
            memberBalances: [
              {
                userId: "user-2",
                displayName: "Alex",
                avatarUrl: null,
                balance: { currency: "EUR", minor: "1234" },
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

const mockReplace = (
  jest.requireMock("expo-router") as {
    router: { replace: jest.Mock };
  }
).router.replace;
const mockDismissTo = (
  jest.requireMock("expo-router") as {
    router: { dismissTo: jest.Mock };
  }
).router.dismissTo;

function renderScreen() {
  return render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <SettleGroupScreen />
    </SafeAreaInsetsContext.Provider>,
  );
}

describe("SettleGroupScreen", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockDismissTo.mockClear();
  });

  it("dismisses directly to the group overview", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Close settle up"));

    expect(mockDismissTo).toHaveBeenCalledWith("/groups/group-1");
  });

  it("opens a prefilled payment form for the viewer's balance", async () => {
    const view = await renderScreen();

    expect(view.getByText("Alex pays you")).toBeTruthy();
    expect(view.getByText("12.34 €")).toBeTruthy();
    expect(view.queryByText("Alex pays Flo")).toBeNull();
    await fireEvent.press(view.getByText("Alex pays you"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "group",
        id: "group-1",
        fromUserId: "user-2",
        toUserId: "user-1",
        canonicalCurrency: "EUR",
        canonicalMinor: "1234",
      },
    });
  });

  it("opens the payment form for a custom amount without recording anything", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByText("Custom payment"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "group",
        id: "group-1",
        fromUserId: "user-1",
        canonicalCurrency: "EUR",
      },
    });
  });
});
