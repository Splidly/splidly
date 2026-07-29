import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { ExpenseEditor } from "./expense-editor";

const mockQuote = jest.fn();

jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = () => null;
  return {
    router: {
      back: jest.fn(),
    },
    Stack: {
      Screen,
      Toolbar,
    },
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
          mutate: jest.fn(),
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
        list: { invalidate: jest.fn() },
      },
    }),
  },
}));

function renderEditor() {
  return render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ExpenseEditor
        newContext={{
          type: "friend",
          friendshipId: "11111111-1111-4111-8111-111111111111",
        }}
      />
    </SafeAreaInsetsContext.Provider>,
  );
}

describe("ExpenseEditor automatic conversion preview", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockQuote.mockReset();
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
    expect(view.getByText("≈ 12.50 USD")).toBeTruthy();
    expect(view.getByText(/1 EUR = 1.25 USD/)).toBeTruthy();
    expect(view.queryByText("Frozen exchange rates")).toBeNull();
  });
});
