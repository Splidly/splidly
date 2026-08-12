import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import SettleGroupScreen from "../app/settlement/group";

let mockGroupSettleParams: {
  id: string;
  returnTo?: "balances" | "settings";
} = {
  id: "group-1",
  returnTo: "balances",
};

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const { Pressable } =
    require("react-native") as typeof import("react-native");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
  );
  return {
    router: {
      dismissTo: jest.fn(),
      replace: jest.fn(),
    },
    Stack: { Screen, Toolbar },
    useLocalSearchParams: () => mockGroupSettleParams,
  };
});

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
    mockGroupSettleParams = { id: "group-1", returnTo: "balances" };
    mockReplace.mockClear();
    mockDismissTo.mockClear();
  });

  it("dismisses back to the balances screen that opened it", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Close settle up"));

    expect(mockDismissTo).toHaveBeenCalledWith("/groups/group-1/balances");
  });

  it("still dismisses to the group when opened from the overview", async () => {
    mockGroupSettleParams = { id: "group-1" };
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Close settle up"));

    expect(mockDismissTo).toHaveBeenCalledWith("/groups/group-1");
  });

  it("dismisses back to settings when opened from the combined member list", async () => {
    mockGroupSettleParams = { id: "group-1", returnTo: "settings" };
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Close settle up"));

    expect(mockDismissTo).toHaveBeenCalledWith("/groups/group-1/settings");
  });

  it("opens a prefilled payment form for the viewer's balance", async () => {
    const view = await renderScreen();

    expect(view.getByText("Alex")).toBeTruthy();
    expect(view.getByText("Pays you")).toBeTruthy();
    expect(view.getByText("12.34 €")).toBeTruthy();
    expect(view.queryByText("Alex pays Flo")).toBeNull();
    await fireEvent.press(view.getByLabelText("Receive 12.34 € from Alex"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/settlement/new",
      params: {
        type: "group",
        id: "group-1",
        fromUserId: "user-2",
        toUserId: "user-1",
        canonicalCurrency: "EUR",
        canonicalMinor: "1234",
        returnTo: "balances",
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
        returnTo: "balances",
      },
    });
  });
});
