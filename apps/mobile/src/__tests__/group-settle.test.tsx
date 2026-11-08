import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import SettleGroupScreen from "../app/settlement/group";

let mockSignedMinor = "1234";
let mockSingleMember = false;
let mockNoBalances = false;

let mockGroupSettleParams: {
  id: string;
  returnTo?: "balances" | "settings";
} = {
  id: "group-1",
  returnTo: "balances",
};

jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  return { ...actual, Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View> };
});

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
            ].filter((_, index) => !mockSingleMember || index === 0),
            memberBalances: mockNoBalances ? [] : [
              {
                userId: "user-2",
                displayName: "Alex",
                avatarUrl: null,
                balance: { currency: "EUR", minor: mockSignedMinor },
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
    mockSignedMinor = "1234";
    mockSingleMember = false;
    mockNoBalances = false;
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

    if (process.env.EXPO_OS === "ios") {
      const list = view.getByTestId("native-activity-list");
      expect(list.props.sections[1]).toMatchObject({ headerTitle: "Lisbon", rows: [{
        settings: { title: "Alex", avatarFallback: { initials: "A" },
          balances: [{ label: "You receive", value: "12.34 €" }] },
      }] });
      await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "payment:user-2:EUR" } });
      await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "payment:user-2:EUR" } });
    } else {
      expect(view.getByText("Alex")).toBeTruthy();
      expect(view.getByText("You receive")).toBeTruthy();
      expect(view.getByText("12.34 €")).toBeTruthy();
      await fireEvent.press(view.getByLabelText("Receive 12.34 € from Alex"));
      await fireEvent.press(view.getByLabelText("Receive 12.34 € from Alex"));
    }
    expect(mockReplace).toHaveBeenCalledTimes(1);

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

    if (process.env.EXPO_OS === "ios") {
      await fireEvent(view.getByTestId("native-activity-list"), "rowPress", { nativeEvent: { rowKey: "custom-payment" } });
    } else {
      await fireEvent.press(view.getByText("Custom payment"));
    }

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
  it("prefills an outgoing payment with the viewer as payer", async () => {
    mockSignedMinor = "-1234";
    const view = await renderScreen();
    if (process.env.EXPO_OS === "ios") {
      const list = view.getByTestId("native-activity-list");
      expect(list.props.sections[1].rows[0].settings.balances[0]).toMatchObject({ label: "You pay", value: "12.34 €" });
      await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "payment:user-2:EUR" } });
    } else {
      expect(view.getByText("You pay")).toBeTruthy();
      await fireEvent.press(view.getByLabelText("Pay Alex 12.34 €"));
    }
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/settlement/new", params: {
      type: "group", id: "group-1", fromUserId: "user-1", toUserId: "user-2",
      canonicalCurrency: "EUR", canonicalMinor: "1234", returnTo: "balances",
    } });
  });

  it("shows settled balances and disables custom payments without another member", async () => {
    mockSignedMinor = "0";
    mockSingleMember = true;
    const view = await renderScreen();
    if (process.env.EXPO_OS === "ios") {
      const list = view.getByTestId("native-activity-list");
      expect(list.props.sections[1].rows[0]).toMatchObject({ selectable: false, settings: { title: "All settled up" } });
      expect(list.props.sections[2].rows[0]).toMatchObject({ selectable: false, settings: { enabled: false, showsDisclosure: false } });
      await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "custom-payment" } });
    } else {
      expect(view.getByText("All settled up")).toBeTruthy();
      expect(view.getByText("Add another member to record a payment")).toBeTruthy();
      await fireEvent.press(view.getByText("Custom payment"));
    }
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("still offers a custom payment when everyone is settled", async () => {
    mockNoBalances = true;
    const view = await renderScreen();
    if (process.env.EXPO_OS === "ios") {
      const list = view.getByTestId("native-activity-list");
      expect(list.props.sections[1].rows[0].settings.title).toBe("All settled up");
      await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "custom-payment" } });
    } else {
      expect(view.getByText("All settled up")).toBeTruthy();
      await fireEvent.press(view.getByText("Custom payment"));
    }
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

});
