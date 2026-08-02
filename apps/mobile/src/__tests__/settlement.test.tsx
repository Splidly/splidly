import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import NewSettlementScreen from "../app/settlement/new";

jest.mock("@expo/ui/community/menu", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    MenuView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

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
      back: jest.fn(),
      dismissTo: jest.fn(),
      push: jest.fn(),
    },
    Stack: { Screen, Toolbar },
    useLocalSearchParams: () => ({
      type: "group",
      id: "group-1",
      friendId: "user-2",
      canonicalCurrency: "EUR",
      canonicalMinor: "1234",
    }),
  };
});

jest.mock("../components/currency-field", () => ({
  CurrencyField: ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => {
    const { Text } = require("react-native") as typeof import("react-native");
    return <Text accessibilityLabel={label}>{value}</Text>;
  },
}));

const mockQuote = jest.fn(async () => ({
  id: "quote-1",
  expiresAt: "2099-08-02T12:00:00.000Z",
  rates: [
    {
      base: "EUR",
      quote: "EUR",
      rate: "1",
      provider: "identity",
      providerDate: "2026-08-02",
      source: "automatic",
    },
    {
      base: "EUR",
      quote: "USD",
      rate: "1.2",
      provider: "Test rates",
      providerDate: "2026-08-02",
      source: "automatic",
    },
  ],
}));

jest.mock("../lib/trpc", () => ({
  api: {
    profile: {
      me: {
        useQuery: jest.fn(() => ({
          data: {
            userId: "user-1",
            displayName: "Lasse",
            homeCurrency: "EUR",
          },
          error: null,
          isPending: false,
        })),
      },
    },
    friends: {
      detail: {
        useQuery: jest.fn(() => ({
          data: undefined,
          error: null,
          isPending: false,
        })),
      },
      list: {
        useQuery: jest.fn(),
      },
    },
    groups: {
      detail: {
        useQuery: jest.fn(() => ({
          data: {
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
              {
                userId: "user-3",
                displayName: "Flo",
                homeCurrency: "EUR",
              },
            ],
          },
          error: null,
          isPending: false,
        })),
      },
      list: {
        useQuery: jest.fn(),
      },
    },
    currency: {
      quote: {
        useMutation: jest.fn(() => ({
          data: undefined,
          error: null,
          isPending: false,
          mutateAsync: mockQuote,
        })),
      },
    },
    settlements: {
      create: {
        useMutation: jest.fn(() => ({
          data: undefined,
          error: null,
          isPending: false,
          mutate: jest.fn(),
        })),
      },
    },
    useUtils: () => ({
      friends: {
        list: { invalidate: jest.fn() },
        detail: { invalidate: jest.fn() },
      },
      groups: {
        list: { invalidate: jest.fn() },
        detail: { invalidate: jest.fn() },
      },
    }),
  },
}));

describe("NewSettlementScreen group context", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockQuote.mockClear();
    (
      jest.requireMock("expo-router") as {
        router: { back: jest.Mock; dismissTo: jest.Mock };
      }
    ).router.back.mockClear();
    (
      jest.requireMock("expo-router") as {
        router: { dismissTo: jest.Mock };
      }
    ).router.dismissTo.mockClear();
    (
      jest.requireMock("../lib/trpc") as {
        api: { settlements: { create: { useMutation: jest.Mock } } };
      }
    ).api.settlements.create.useMutation.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  it("loads the counterparty from group membership without a friendship route", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    const mockedApi = (
      jest.requireMock("../lib/trpc") as {
        api: {
          friends: { detail: { useQuery: jest.Mock } };
          groups: { detail: { useQuery: jest.Mock } };
        };
      }
    ).api;

    await act(async () => {});
    expect(view.getByLabelText("Paid by: Alex")).toBeTruthy();
    expect(view.getByLabelText("Paid to: You")).toBeTruthy();
    expect(view.getByDisplayValue("12.34")).toBeTruthy();
    expect(view.queryByText("Preview conversion")).toBeNull();
    expect(
      view.queryByText(/Splidly updates the ledger/),
    ).toBeNull();
    expect(mockedApi.friends.detail.useQuery).toHaveBeenCalledWith(
      { friendshipId: "" },
      { enabled: false },
    );
    expect(mockedApi.groups.detail.useQuery).toHaveBeenCalledWith(
      { groupId: "group-1" },
      { enabled: true },
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(mockQuote).toHaveBeenCalledWith({
      base: "EUR",
      targets: ["EUR", "USD"],
    });

    await fireEvent(view.getByTestId("settlement-paid-by"), "pressAction", {
      nativeEvent: { event: "user-3" },
    });
    expect(view.getByLabelText("Paid by: Flo")).toBeTruthy();
  });

  it("can always be cancelled from the native sheet toolbar", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    await fireEvent.press(view.getByLabelText("Cancel payment"));

    expect(
      (
        jest.requireMock("expo-router") as {
          router: { dismissTo: jest.Mock };
        }
      ).router.dismissTo,
    ).toHaveBeenCalledWith("/groups/group-1");
  });

  it("dismisses to the group after a payment is recorded", async () => {
    await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    const createHook = (
      jest.requireMock("../lib/trpc") as {
        api: { settlements: { create: { useMutation: jest.Mock } } };
      }
    ).api.settlements.create.useMutation;
    const options = createHook.mock.calls[0]?.[0] as {
      onSuccess: () => Promise<void>;
    };

    await act(async () => options.onSuccess());

    expect(
      (
        jest.requireMock("expo-router") as {
          router: { dismissTo: jest.Mock };
        }
      ).router.dismissTo,
    ).toHaveBeenCalledWith("/groups/group-1");
  });
});
