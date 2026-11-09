import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupBalancesScreen from "../app/(tabs)/groups/[id]/balances";

jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  // Jest has no native Material palette service for decorative chevrons.
  return { ...actual, Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View> };
});

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual(
    "react-native",
  ) as typeof import("react-native");
  return {
    __esModule: true,
    default: { View },
    FadeIn: { duration: () => undefined },
    FadeOut: { duration: () => undefined },
  };
});

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel: string;
    children: React.ReactNode;
    onPress: () => void;
  }) => {
    const { Pressable, Text } =
      require("react-native") as typeof import("react-native");
    return (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    );
  };
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({
      id: "group-1",
    })),
    Stack: { Screen, Toolbar },
  };
});

const mockedExpoRouter = jest.requireMock("expo-router") as {
  router: { push: jest.Mock };
  useLocalSearchParams: jest.Mock;
};
const mockPush = mockedExpoRouter.router.push;
const mockUseLocalSearchParams = mockedExpoRouter.useLocalSearchParams;

const mockBalanceData = {
  group: {
    id: "group-1",
    name: "Lisbon",
    currency: "EUR" as const,
    simplifyDebts: false,
  },
  members: [
    {
      userId: "viewer",
      displayName: "Lasse",
      avatarUrl: null,
      isViewer: true,
      owes: { currency: "EUR" as const, minor: "0" },
      lent: { currency: "EUR" as const, minor: "500" },
      relationships: [
        {
          kind: "lent" as const,
          counterpartyId: "alex",
          counterpartyDisplayName: "Alex",
          counterpartyAvatarUrl: null,
          amount: { currency: "EUR" as const, minor: "500" },
        },
      ],
    },
    {
      userId: "alex",
      displayName: "Alex",
      avatarUrl: null,
      isViewer: false,
      owes: { currency: "EUR" as const, minor: "1000" },
      lent: { currency: "EUR" as const, minor: "1500" },
      relationships: [
        {
          kind: "owes" as const,
          counterpartyId: "sam",
          counterpartyDisplayName: "Sam",
          counterpartyAvatarUrl: null,
          amount: { currency: "EUR" as const, minor: "1000" },
        },
        {
          kind: "lent" as const,
          counterpartyId: "bea",
          counterpartyDisplayName: "Bea",
          counterpartyAvatarUrl: null,
          amount: { currency: "EUR" as const, minor: "1500" },
        },
      ],
    },
    {
      userId: "sam",
      displayName: "Sam",
      avatarUrl: null,
      isViewer: false,
      owes: { currency: "EUR" as const, minor: "0" },
      lent: { currency: "EUR" as const, minor: "0" },
      relationships: [],
    },
  ],
};

jest.mock("../lib/trpc", () => ({
  api: {
    groups: {
      balances: {
        useQuery: () => ({
          data: mockBalanceData,
          error: null,
          isPending: false,
          isRefetching: false,
          refetch: jest.fn(),
        }),
      },
    },
  },
}));

async function renderScreen(screen: React.ReactElement) {
  return await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {screen}
    </SafeAreaInsetsContext.Provider>,
  );
}

describe("group balances", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseLocalSearchParams.mockReturnValue({
      id: "group-1",
    });
  });

  it("keeps member expansion in the list without presenting another route", async () => {
    const view = await renderScreen(<GroupBalancesScreen />);
    if (process.env.EXPO_OS === "ios") {
      const list = view.getByTestId("native-activity-list");
      const rows = list.props.sections[1].rows;
      expect(rows.map((row: { settings: { title: string } }) => row.settings.title)).toEqual(["Lasse (You)", "Alex", "Sam"]);
      expect(rows[1].settings).toMatchObject({
        disclosure: true, showsDisclosure: false,
        value: "Owes 10.00 €\nLent 15.00 €",
        balances: [
          { label: "Owes", value: "10.00 €", color: expect.any(String) },
          { label: "Lent", value: "15.00 €", color: expect.any(String) },
        ],
        details: [
          { title: "Owes Sam", value: "10.00 €", tone: "negative" },
          { title: "Bea owes Alex", value: "15.00 €", tone: "positive" },
        ],
      });
      expect(rows[1].selectable).toBe(false);
      expect(rows[1].settings.balances[0].color).not.toBe(rows[1].settings.balances[1].color);
      expect(rows[0].settings.balances[0].label).toBe("You lent");
      expect(rows[2].settings.balances).toEqual([{ label: "Settled", value: "", color: expect.any(String) }]);
      expect(rows[2].settings.details).toEqual([{ title: "No outstanding balances.", value: "", tone: "muted" }]);
    } else {
      const row = view.getByLabelText("Alex. Owes 10.00 € · Lent 15.00 €");
      expect(row.props.accessibilityState.expanded).toBe(false);
      await fireEvent.press(row);
      expect(view.getByText("Owes Sam")).toBeTruthy();
      expect(view.getByText("Bea owes Alex")).toBeTruthy();
      expect(view.getByLabelText("Alex. Owes 10.00 € · Lent 15.00 €").props.accessibilityState.expanded).toBe(true);
      await fireEvent.press(view.getByLabelText("Sam. Settled up"));
      expect(view.getByText("No outstanding balances.")).toBeTruthy();
      expect(view.getByText("Owes Sam")).toBeTruthy();
      await fireEvent.press(view.getByLabelText("Alex. Owes 10.00 € · Lent 15.00 €"));
      expect(view.queryByText("Owes Sam")).toBeNull();
    }
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps the group settle-up action reachable", async () => {
    const view = await renderScreen(<GroupBalancesScreen />);
    await fireEvent.press(view.getByLabelText("Settle up Lisbon"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/settlement/group", params: { id: "group-1", returnTo: "balances" } });
  });
});
