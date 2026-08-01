import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupDetailScreen from "../app/(tabs)/groups/[id]";

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Toolbar.Button = () => null;
  return {
    router: {
      push: jest.fn(),
    },
    useLocalSearchParams: () => ({ id: "group-1" }),
    Stack: {
      Screen,
      Toolbar,
    },
  };
});

jest.mock("../lib/trpc", () => ({
  api: {
    groups: {
      detail: {
        useQuery: () => ({
          data: {
            group: {
              id: "group-1",
              name: "Lisbon",
              iconKey: "trip",
              color: "#1764B0",
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
                homeCurrency: "USD",
              },
            ],
            memberBalances: [
              {
                userId: "user-2",
                displayName: "Alex",
                balance: { currency: "EUR", minor: "-1234" },
              },
            ],
            settlements: [
              {
                id: "settlement-1",
                occurredAt: new Date("2026-07-21T12:00:00.000Z"),
                notes: "",
                amount: { currency: "EUR", minor: "600" },
                from: {
                  userId: "user-2",
                  displayName: "Alex",
                  avatarUrl: null,
                  isViewer: false,
                },
                to: {
                  userId: "user-1",
                  displayName: "Lasse",
                  avatarUrl: null,
                  isViewer: true,
                },
              },
            ],
            expenses: [
              {
                id: "expense-1",
                description: "Dinner",
                occurredAt: new Date("2026-07-20T12:00:00.000Z"),
                sourceCurrency: "USD",
                sourceAmountMinor: 1_000n,
                canonicalAmount: { currency: "EUR", minor: "850" },
                payers: [
                  {
                    userId: "user-2",
                    displayName: "Alex",
                    isViewer: false,
                  },
                ],
                paymentTotal: { currency: "USD", minor: "1000" },
                viewerInvolvement: {
                  kind: "borrowed",
                  amount: { currency: "USD", minor: "400" },
                },
                iconKey: "food",
                iconManuallySet: true,
              },
              {
                id: "expense-2",
                description: "Taxi",
                occurredAt: new Date("2026-07-19T12:00:00.000Z"),
                sourceCurrency: "EUR",
                sourceAmountMinor: 2_400n,
                canonicalAmount: { currency: "EUR", minor: "2400" },
                payers: [
                  {
                    userId: "user-1",
                    displayName: "Lasse",
                    isViewer: true,
                  },
                  {
                    userId: "user-2",
                    displayName: "Alex",
                    isViewer: false,
                  },
                ],
                paymentTotal: { currency: "EUR", minor: "2400" },
                viewerInvolvement: {
                  kind: "lent",
                  amount: { currency: "EUR", minor: "1000" },
                },
                iconKey: "transport",
                iconManuallySet: true,
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

const mockPush = (
  jest.requireMock("expo-router") as {
    router: { push: jest.Mock };
  }
).router.push;

describe("GroupDetailScreen actions", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("opens one settle-up sheet instead of rendering balance actions", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupDetailScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByLabelText("You owe Alex 12.34 €")).toBeTruthy();
    expect(view.getByText(/Alex paid \$10\.00$/)).toBeTruthy();
    expect(view.getByText("You borrowed")).toBeTruthy();
    expect(view.getByText("$4.00")).toBeTruthy();
    expect(view.getByText(/You \+ Alex paid 24\.00 €$/)).toBeTruthy();
    expect(view.getByText("You lent")).toBeTruthy();
    expect(view.getByText("10.00 €")).toBeTruthy();
    expect(view.getByText("Payment")).toBeTruthy();
    expect(view.getByText(/21 Jul · Alex paid you 6\.00 €$/)).toBeTruthy();
    expect(view.getByText("You received")).toBeTruthy();
    expect(view.getByText("6.00 €")).toBeTruthy();
    expect(view.queryByText("Open balances")).toBeNull();
    expect(view.queryByText("Statistics")).toBeNull();
    await fireEvent.press(view.getByText("Settle up"));

    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/settle");
  });
});
