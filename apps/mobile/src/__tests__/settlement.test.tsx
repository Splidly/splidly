import { render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import NewSettlementScreen from "../app/settlement/new";

jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({
    type: "group",
    id: "group-1",
    friendId: "user-2",
    canonicalCurrency: "EUR",
    canonicalMinor: "1234",
  }),
}));

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
          mutateAsync: jest.fn(),
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

    expect(view.getByText("Alex paid you")).toBeTruthy();
    expect(mockedApi.friends.detail.useQuery).toHaveBeenCalledWith(
      { friendshipId: "" },
      { enabled: false },
    );
    expect(mockedApi.groups.detail.useQuery).toHaveBeenCalledWith(
      { groupId: "group-1" },
      { enabled: true },
    );
  });
});
