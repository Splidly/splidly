import { act, fireEvent, render } from "@testing-library/react-native";
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements/Header/HeaderHeightContext";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { ExpenseEditor } from "./expense-editor";
import { ExpensePaymentEditor } from "./expense-payment-editor";
import {
  ExpensePaymentSessionProvider,
  useExpensePaymentSession,
} from "./expense-payment-session";
import { ExpenseSplitSessionProvider } from "./expense-split-session";

const mockQuote = jest.fn();
const mockCreateExpense = jest.fn();

jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const {
      Pressable,
      Text,
    } = require("react-native") as typeof import("react-native");
    return (
      <Pressable {...props}>
        <Text>{children}</Text>
      </Pressable>
    );
  };
  Toolbar.View = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    router: {
      back: jest.fn(),
      push: jest.fn(),
    },
    Stack: {
      Screen,
      Toolbar,
    },
  };
});

jest.mock("@expo/ui/community/menu", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    MenuView: ({
      children,
      ...props
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => <View {...props}>{children}</View>,
  };
});

jest.mock("./currency-field", () => ({
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

jest.mock("./date-field", () => ({
  DateField: () => {
    const { Text } = require("react-native") as typeof import("react-native");
    return <Text>Date</Text>;
  },
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
          data: undefined,
          error: null,
          isPending: false,
        }),
      },
      list: {
        useQuery: () => ({
          data: [],
          error: null,
          isPending: false,
        }),
      },
    },
    friends: {
      detail: {
        useQuery: () => ({
          data: {
            friendship: { id: "11111111-1111-4111-8111-111111111111" },
            friend: {
              userId: "user-2",
              displayName: "Friend",
              homeCurrency: "USD",
            },
            expenses: [],
          },
          error: null,
          isPending: false,
        }),
      },
      list: {
        useQuery: () => ({
          data: [],
          error: null,
          isPending: false,
        }),
      },
    },
    expenses: {
      detail: {
        useQuery: () => ({
          data: undefined,
          error: null,
          isPending: false,
        }),
      },
      create: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: mockCreateExpense,
        }),
      },
      update: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: jest.fn(),
        }),
      },
    },
    currency: {
      quote: {
        useMutation: () => ({
          mutateAsync: mockQuote,
        }),
      },
    },
    useUtils: () => ({
      expenses: {
        detail: { invalidate: jest.fn() },
      },
      friends: {
        detail: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
      groups: {
        detail: { invalidate: jest.fn() },
        balances: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
  },
}));

function EditorHarness() {
  const paymentSession = useExpensePaymentSession();
  return (
    <>
      <ExpenseEditor
        newContext={{
          type: "friend",
          friendshipId: "11111111-1111-4111-8111-111111111111",
        }}
      />
      {paymentSession.request ? <ExpensePaymentEditor /> : null}
    </>
  );
}

function renderEditor() {
  return render(
    <HeaderHeightContext.Provider value={96}>
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <ExpensePaymentSessionProvider>
          <ExpenseSplitSessionProvider>
            <EditorHarness />
          </ExpenseSplitSessionProvider>
        </ExpensePaymentSessionProvider>
      </SafeAreaInsetsContext.Provider>
    </HeaderHeightContext.Provider>,
  );
}

describe("ExpenseEditor", () => {
  it("opens a new expense sheet without moving it to the focused field", async () => {
    const view = await renderEditor();

    expect(view.getByLabelText("Description").props.autoFocus).toBe(false);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockQuote.mockReset();
    mockCreateExpense.mockReset();
    mockQuote.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2026-07-28T22:00:00.000Z",
      rates: [
        {
          base: "EUR",
          quote: "EUR",
          rate: "1",
          provider: "identity",
          providerDate: "2026-07-28",
          source: "automatic",
        },
        {
          base: "EUR",
          quote: "USD",
          rate: "1.25",
          provider: "Test rates",
          providerDate: "2026-07-28",
          source: "automatic",
        },
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses a focused composer with progressive details and a floating save action", async () => {
    const view = await renderEditor();
    await act(async () => {});

    expect(view.getByTestId("expense-entry-card")).toBeTruthy();
    expect(view.getByLabelText("Description").props.inputAccessoryViewID).toBe(
      "expense-description-primary-action",
    );
    expect(view.getByLabelText("Amount").props.inputAccessoryViewID).toBe(
      "expense-amount-primary-action",
    );
    expect(view.getByLabelText("Currency")).toBeTruthy();
    expect(view.getByText("Payment plan")).toBeTruthy();
    expect(view.getByLabelText("Paid by")).toBeTruthy();
    expect(view.getByLabelText("Split")).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText("Amount"), "10.00");
    expect(view.getByText("Paid by You")).toBeTruthy();
    expect(view.queryByText("You paid")).toBeNull();
    expect(view.queryByLabelText("Notes")).toBeNull();
    expect(
      view.queryByText("Splidly records the expense. It does not charge anyone."),
    ).toBeNull();

    await fireEvent.press(view.getByText("Add a note"));

    expect(view.getByLabelText("Notes").props.onContentSizeChange).toEqual(
      expect.any(Function),
    );
    expect(view.getByTestId("screen-bottom-overlay")).toBeTruthy();
    expect(view.getByText("Save expense")).toBeTruthy();
    expect(view.getAllByText("Add expense")).toHaveLength(2);

    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("Expense ScrollView was not rendered");
    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    expect(
      StyleSheet.flatten(resizedScrollView?.props.contentContainerStyle)
        .minHeight,
    ).toBe(800);

    if (!resizedScrollView) throw new Error("Expense ScrollView was not resized");
    await fireEvent(resizedScrollView, "contentSizeChange", 400, 1_000);
    const [overflowingScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    expect(
      StyleSheet.flatten(overflowingScrollView?.props.contentContainerStyle)
        .paddingBottom,
    ).toBe(108);
  });

  it("formats the amount to the currency precision when focus leaves", async () => {
    const view = await renderEditor();
    await act(async () => {});

    const amount = view.getByLabelText("Amount");
    await fireEvent.changeText(amount, "5");
    await fireEvent(amount, "blur");

    expect(view.getByLabelText("Amount").props.value).toBe("5.00");
  });

  it("loads conversion metadata after a short amount-entry debounce", async () => {
    const view = await renderEditor();

    await fireEvent.changeText(view.getByLabelText("Amount"), "10.00");

    expect(view.queryByText("Preview conversion")).toBeNull();
    expect(view.getByText("Updating exchange rates…")).toBeTruthy();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(449);
    });
    expect(mockQuote).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    expect(mockQuote).toHaveBeenCalledWith({
      base: "EUR",
      targets: ["EUR", "USD"],
    });
    expect(view.getByText("≈ $12.50")).toBeTruthy();
    expect(view.getByText(/1 EUR = 1.25 USD/)).toBeTruthy();
    expect(view.queryByText("Frozen exchange rates")).toBeNull();
  });

  it("updates the expense icon while the description is entered", async () => {
    const view = await renderEditor();
    await act(async () => {});
    const description = view.getByLabelText("Description");

    expect(
      view.getByLabelText("Change expense category. Automatic: Other"),
    ).toBeTruthy();

    await fireEvent.changeText(description, "Warmmiete Juli");
    expect(
      view.getByLabelText("Change expense category. Automatic: Housing"),
    ).toBeTruthy();

    await fireEvent.changeText(description, "Dinner im Restaurant");
    expect(
      view.getByLabelText("Change expense category. Automatic: Dining"),
    ).toBeTruthy();
  });

  it("keeps a manual category until automatic detection is restored", async () => {
    const view = await renderEditor();
    await act(async () => {});
    const description = view.getByLabelText("Description");
    const picker = view.getByTestId("expense-icon-picker");

    await fireEvent.changeText(description, "Warmmiete Juli");
    await fireEvent(picker, "pressAction", {
      nativeEvent: { event: "travel" },
    });

    expect(
      view.getByLabelText("Change expense category. Travel"),
    ).toBeTruthy();

    await fireEvent.changeText(description, "Dinner im Restaurant");
    expect(
      view.getByLabelText("Change expense category. Travel"),
    ).toBeTruthy();

    await fireEvent(
      view.getByTestId("expense-icon-picker"),
      "pressAction",
      {
        nativeEvent: { event: "other" },
      },
    );
    expect(
      view.getByLabelText("Change expense category. Other"),
    ).toBeTruthy();

    await fireEvent(
      view.getByTestId("expense-icon-picker"),
      "pressAction",
      {
        nativeEvent: { event: "automatic" },
      },
    );
    expect(
      view.getByLabelText("Change expense category. Automatic: Dining"),
    ).toBeTruthy();
  });

  it("submits the manual category as a persistent override", async () => {
    const view = await renderEditor();
    await act(async () => {});

    await fireEvent.changeText(
      view.getByLabelText("Description"),
      "Warmmiete",
    );
    await fireEvent.changeText(view.getByLabelText("Amount"), "10.00");
    await fireEvent(
      view.getByTestId("expense-icon-picker"),
      "pressAction",
      {
        nativeEvent: { event: "travel" },
      },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(450);
    });
    await fireEvent.press(view.getByText("Save expense"));

    expect(mockCreateExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Warmmiete",
        iconKey: "travel",
        iconManuallySet: true,
      }),
    );

    await fireEvent.press(view.getByText("Save expense"));
    expect(mockCreateExpense).toHaveBeenCalledTimes(2);
    expect(mockCreateExpense.mock.calls[1]?.[0].clientMutationId).toBe(
      mockCreateExpense.mock.calls[0]?.[0].clientMutationId,
    );
  });

  it("requires multiple payer contributions to cover the full expense", async () => {
    const view = await renderEditor();
    await act(async () => {});

    await fireEvent.changeText(view.getByLabelText("Description"), "Dinner");
    await fireEvent.changeText(view.getByLabelText("Amount"), "70.00");
    await fireEvent.press(view.getByLabelText("Paid by"));
    await fireEvent(
      view.getByLabelText("Friend paid"),
      "valueChange",
      true,
    );

    expect(
      view.getByLabelText("70.00 € of 70.00 €, Complete"),
    ).toBeTruthy();
    await fireEvent.changeText(
      view.getByLabelText("Lasse paid amount"),
      "50.00",
    );
    expect(
      view.getByLabelText("85.00 € of 70.00 €, Incomplete"),
    ).toBeTruthy();

    await fireEvent.changeText(
      view.getByLabelText("Friend paid amount"),
      "20.00",
    );
    expect(
      view.getByLabelText("70.00 € of 70.00 €, Complete"),
    ).toBeTruthy();
    await fireEvent.press(
      view.getByLabelText("Save payment allocation"),
    );

    expect(view.getByText("Paid by")).toBeTruthy();
    expect(view.getByText("You and Friend paid")).toBeTruthy();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(450);
    });
    await fireEvent.press(view.getByText("Save expense"));

    expect(mockCreateExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        payments: [
          { userId: "user-1", amountMinor: "5000" },
          { userId: "user-2", amountMinor: "2000" },
        ],
        split: {
          mode: "equal",
          participantIds: ["user-2", "user-1"],
        },
      }),
    );
  });
});
