import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupBalancesScreen from "../app/(tabs)/groups/[id]/balances";

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
    router: { push: jest.fn() },
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

  it("lists every member with owes, lent, and settled statuses", async () => {
    const view = await renderScreen(<GroupBalancesScreen />);

    expect(view.getByText("Lasse (You)")).toBeTruthy();
    expect(view.getByText("Lent 5.00 €")).toBeTruthy();
    expect(view.getByText("Owes 10.00 €")).toBeTruthy();
    expect(view.getByText("Lent 15.00 €")).toBeTruthy();
    expect(view.getByText("Settled up")).toBeTruthy();
    expect(
      view.getByLabelText("Alex. Owes 10.00 € · Lent 15.00 €"),
    ).toBeTruthy();
    expect(
      view.getByText("Balances preserve who owes whom in this group."),
    ).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Settle up Lisbon"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement/group",
      params: { id: "group-1", returnTo: "balances" },
    });

    const alexRow = view.getByLabelText(
      "Alex. Owes 10.00 € · Lent 15.00 €",
    );
    expect(alexRow.props.accessibilityState).toEqual({ expanded: false });
    expect(
      view.getByTestId("balance-disclosure-alex-collapsed", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(view.queryByText("Bea")).toBeNull();

    await fireEvent.press(alexRow);
    expect(view.getAllByText("10.00 €").length).toBeGreaterThan(0);
    expect(view.getAllByText("15.00 €").length).toBeGreaterThan(0);
    expect(view.getByLabelText("Alex owes 10.00 € to Sam")).toBeTruthy();
    expect(view.getByLabelText("Bea owes 15.00 € to Alex")).toBeTruthy();
    expect(view.queryByText(/Remind/i)).toBeNull();
    expect(alexRow.props.accessibilityState).toEqual({ expanded: true });
    expect(
      view.getByTestId("balance-disclosure-alex-expanded", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    const lasseRow = view.getByLabelText("Lasse (You). Lent 5.00 €");
    await fireEvent.press(lasseRow);
    expect(view.getByLabelText("Alex owes 5.00 € to you")).toBeTruthy();
    expect(view.getByLabelText("Alex owes 10.00 € to Sam")).toBeTruthy();
    expect(lasseRow.props.accessibilityState).toEqual({ expanded: true });
    expect(alexRow.props.accessibilityState).toEqual({ expanded: true });

    await fireEvent.press(alexRow);
    expect(view.queryByLabelText("Alex owes 10.00 € to Sam")).toBeNull();
    expect(alexRow.props.accessibilityState).toEqual({ expanded: false });

    const samRow = view.getByLabelText("Sam. Settled up");
    await fireEvent.press(samRow);
    expect(view.getByText("No outstanding balances.")).toBeTruthy();
    expect(samRow.props.accessibilityState).toEqual({ expanded: true });
  });
});
