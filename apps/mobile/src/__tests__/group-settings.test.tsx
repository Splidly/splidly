import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupSettingsScreen from "../app/(tabs)/groups/[id]/settings";

const mockUpdateMutate = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    dismissTo: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "group-1" }),
}));

const mockPush = (
  jest.requireMock("expo-router") as {
    router: { push: jest.Mock };
  }
).router.push;

jest.mock("../lib/share-invite", () => ({
  shareInvite: jest.fn(),
}));

jest.mock("../lib/trpc", () => ({
  api: {
    useUtils: () => ({
      groups: {
        detail: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
    groups: {
      detail: {
        useQuery: () => ({
          data: {
            group: {
              id: "group-1",
              name: "Lisbon",
              iconKey: "trip",
              currency: "EUR",
              simplifyDebts: true,
              version: 3,
              createdBy: "user-1",
            },
            members: [
              {
                userId: "user-1",
                displayName: "Lasse",
                homeCurrency: "EUR",
              },
            ],
          },
          error: null,
          isPending: false,
          refetch: jest.fn(),
        }),
      },
      update: {
        useMutation: () => ({
          mutate: mockUpdateMutate,
          error: null,
          isPending: false,
        }),
      },
      removeMember: {
        useMutation: () => ({
          mutate: jest.fn(),
          error: null,
          isPending: false,
        }),
      },
      leave: {
        useMutation: () => ({ mutate: jest.fn(), error: null }),
      },
      archive: {
        useMutation: () => ({ mutate: jest.fn(), error: null }),
      },
      delete: {
        useMutation: () => ({ mutate: jest.fn(), error: null }),
      },
    },
    profile: {
      me: {
        useQuery: () => ({ data: { userId: "user-1" } }),
      },
    },
    invites: {
      create: {
        useMutation: () => ({
          mutate: jest.fn(),
          error: null,
          isPending: false,
        }),
      },
    },
  },
}));

describe("GroupSettingsScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUpdateMutate.mockClear();
  });

  it("shows a read-only group summary and opens the edit sheet", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByText("Lisbon")).toBeTruthy();
    expect(view.getAllByText("EUR").length).toBeGreaterThan(0);
    expect(view.queryByText(/All settled up/)).toBeNull();
    expect(view.queryByLabelText("Name")).toBeNull();

    await fireEvent.press(view.getByLabelText("Edit Lisbon"));

    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/edit");
  });

  it("persists debt simplification directly from its switch", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    await fireEvent(
      view.getByLabelText("Simplify debts"),
      "valueChange",
      false,
    );

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      groupId: "group-1",
      expectedVersion: 3,
      name: "Lisbon",
      iconKey: "trip",
      currency: "EUR",
      simplifyDebts: false,
    });
  });
});
