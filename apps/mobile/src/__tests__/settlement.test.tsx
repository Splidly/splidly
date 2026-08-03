import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import NewSettlementScreen from "../app/settlement/new";

let mockSettlementParams: Record<string, string | undefined> = {};
let mockSettlementDetailData: unknown;

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
    useLocalSearchParams: () => mockSettlementParams,
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
          data: mockSettlementDetailData,
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
      detail: {
        useQuery: jest.fn(() => ({
          data: mockSettlementDetailData,
          error: null,
          isPending: false,
        })),
      },
      create: {
        useMutation: jest.fn(() => ({
          data: undefined,
          error: null,
          isPending: false,
          mutate: jest.fn(),
        })),
      },
      update: {
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
      settlements: {
        detail: { invalidate: jest.fn() },
      },
    }),
  },
}));

describe("NewSettlementScreen group context", () => {
  beforeEach(() => {
    mockSettlementParams = {
      type: "group",
      id: "group-1",
      friendId: "user-2",
      canonicalCurrency: "EUR",
      canonicalMinor: "1234",
    };
    mockSettlementDetailData = undefined;
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
    expect(
      StyleSheet.flatten(view.getByTestId("settlement-paid-by-slot").props.style)
        .flex,
    ).toBe(1);
    expect(
      StyleSheet.flatten(view.getByTestId("settlement-paid-to-slot").props.style)
        .flex,
    ).toBe(1);
    expect(
      StyleSheet.flatten(
        view.getByTestId("settlement-direction-arrow", {
          includeHiddenElements: true,
        }).props.style,
      ),
    ).toEqual(
      expect.objectContaining({ alignSelf: "flex-start", marginTop: 13 }),
    );
    expect(
      view.getByTestId("currency-chevron", { includeHiddenElements: true }),
    ).toBeTruthy();
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

  it("formats the payment amount to the currency precision on blur", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    await act(async () => {});

    const amount = view.getByLabelText("Amount");
    await fireEvent.changeText(amount, "8");
    await fireEvent(amount, "blur");

    expect(view.getByLabelText("Amount").props.value).toBe("8.00");
  });

  it("allows matching party choices but disables recording", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    await act(async () => {});

    expect(
      view.getByTestId("settlement-paid-by").props.actions.some(
        (action: { id: string }) => action.id === "user-1",
      ),
    ).toBe(true);
    await fireEvent(view.getByTestId("settlement-paid-by"), "pressAction", {
      nativeEvent: { event: "user-1" },
    });

    expect(
      view.getByText("Record payment").parent?.props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it("keeps a growing note tied to the focused-input scroll behavior", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    await act(async () => {});

    await fireEvent.press(view.getByText("Add a note"));

    expect(view.getByLabelText("Notes").props.onContentSizeChange).toEqual(
      expect.any(Function),
    );
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

  it("loads and updates an existing payment", async () => {
    mockSettlementParams = {
      type: "group",
      id: "group-1",
      canonicalCurrency: "EUR",
      settlementId: "settlement-1",
    };
    mockSettlementDetailData = {
      settlement: {
        id: "settlement-1",
        version: 2,
        fromUserId: "user-3",
        toUserId: "user-1",
        sourceCurrency: "EUR",
        sourceAmountMinor: 900n,
        occurredAt: new Date("2026-07-20T12:00:00.000Z"),
        notes: "Cash",
      },
      rates: [],
    };

    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NewSettlementScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    await act(async () => {});

    expect(view.getByDisplayValue("9.00")).toBeTruthy();
    expect(view.getByLabelText("Paid by: Flo")).toBeTruthy();
    expect(view.getByDisplayValue("Cash")).toBeTruthy();
    const saveButton = view.getByText("Save changes").parent;
    expect(saveButton?.props.accessibilityState).toEqual({ disabled: false });
    if (!saveButton) throw new Error("Save button not found");
    await fireEvent.press(saveButton);

    const updateHook = (
      jest.requireMock("../lib/trpc") as {
        api: { settlements: { update: { useMutation: jest.Mock } } };
      }
    ).api.settlements.update.useMutation;
    const updateMutate = updateHook.mock.results
      .map((result) => result.value.mutate as jest.Mock)
      .find((mutate) => mutate.mock.calls.length > 0);
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementId: "settlement-1",
        expectedVersion: 2,
        fromUserId: "user-3",
        toUserId: "user-1",
        notes: "Cash",
      }),
    );
  });
});
