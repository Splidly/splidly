import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import ExpenseDetailScreen from "../app/expense/[id]";

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
    router: { back: jest.fn(), push: jest.fn() },
    Stack: { Screen, Toolbar },
    useLocalSearchParams: () => ({ id: "expense-1" }),
  };
});

jest.mock("../components/expense-icon", () => ({
  ExpenseIcon: () => null,
}));

jest.mock("../lib/trpc", () => ({
  api: {
    expenses: {
      detail: {
        useQuery: () => ({
          data: {
            expense: {
              id: "expense-1",
              groupId: "group-1",
              friendshipId: null,
              contextType: "group",
              description: "Dinner",
              iconKey: "dining",
              iconManuallySet: false,
              notes: "Great evening",
              occurredAt: new Date("2026-08-13T12:00:00.000Z"),
              sourceCurrency: "USD",
              sourceAmountMinor: 10_000n,
              version: 2,
            },
            payers: [
              {
                userId: "user-1",
                displayName: "Lasse",
                avatarUrl: null,
                homeCurrency: "EUR",
                sourceAmountMinor: 10_000n,
              },
            ],
            splits: [
              {
                userId: "user-1",
                displayName: "Lasse",
                avatarUrl: null,
                homeCurrency: "EUR",
                sourceAmountMinor: 6_000n,
              },
              {
                userId: "user-2",
                displayName: "Alex",
                avatarUrl: null,
                homeCurrency: "EUR",
                sourceAmountMinor: 4_000n,
              },
            ],
            rates: [
              {
                base: "USD",
                quote: "EUR",
                rate: "0.92",
                provider: "ECB",
                providerDate: "2026-08-13",
                source: "automatic",
              },
            ],
            split: {
              mode: "exact",
              shares: [
                { userId: "user-1", amountMinor: "6000" },
                { userId: "user-2", amountMinor: "4000" },
              ],
            },
          },
          error: null,
          isPending: false,
        }),
      },
      remove: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: jest.fn(),
        }),
      },
    },
    profile: {
      me: {
        useQuery: () => ({
          data: { userId: "user-1", homeCurrency: "EUR" },
          error: null,
        }),
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
        balances: { invalidate: jest.fn() },
      },
    }),
  },
}));

describe("expense details", () => {
  it("shows a polished summary with the saved home-currency total", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <ExpenseDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("Dinner")).toBeTruthy();
    expect(view.getAllByText("$100.00")).toHaveLength(2);
    expect(
      StyleSheet.flatten(view.getByTestId("expense-summary-line").props.style)
        .flexDirection,
    ).toBe("row");
    expect(view.getByLabelText("92.00 € in your home currency")).toBeTruthy();
    expect(view.getByText("55.20 €")).toBeTruthy();
    expect(view.getByText("36.80 €")).toBeTruthy();
    expect(view.getByText("Paid by")).toBeTruthy();
    expect(view.getByText("Split · Custom amount")).toBeTruthy();
    expect(view.getByText("Great evening")).toBeTruthy();
    expect(view.getByText("Exchange rate")).toBeTruthy();
    expect(
      view.queryByText("›", { includeHiddenElements: true }),
    ).toBeNull();
  });
});
