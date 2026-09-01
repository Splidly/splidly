import { fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupSettingsScreen from "../app/(tabs)/groups/[id]/settings";

const mockUpdateMutate = jest.fn();
const mockRemoveMutate = jest.fn();

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

jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const React = require("react") as typeof import("react");
  const { View } =
    require("react-native") as typeof import("react-native");
  return function MockSwipeable({
    children,
    renderRightActions,
    testID,
  }: {
    children: React.ReactNode;
    renderRightActions: (
      progress: { value: number },
      translation: { value: number },
      methods: { close: () => void },
    ) => React.ReactNode;
    testID: string;
  }) {
    return (
      <View testID={testID}>
        {children}
        {renderRightActions(
          { value: 1 },
          { value: -88 },
          { close: jest.fn() },
        )}
      </View>
    );
  };
});

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
      push: jest.fn(),
      back: jest.fn(),
      dismissTo: jest.fn(),
    },
    Stack: { Screen, Toolbar },
    useLocalSearchParams: () => ({ id: "group-1" }),
  };
});

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
        balances: { invalidate: jest.fn() },
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
              color: "#1764B0",
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
              {
                userId: "user-3",
                displayName: "Zoe",
                homeCurrency: "GBP",
              },
              {
                userId: "user-2",
                displayName: "Alex",
                homeCurrency: "USD",
              },
            ],
            balanceMembers: [
              {
                userId: "user-1",
                displayName: "Lasse",
                avatarUrl: null,
                isViewer: true,
                owes: { currency: "EUR", minor: "0" },
                lent: { currency: "EUR", minor: "500" },
                relationships: [
                  {
                    kind: "lent",
                    counterpartyId: "user-2",
                    counterpartyDisplayName: "Alex",
                    counterpartyAvatarUrl: null,
                    amount: { currency: "EUR", minor: "500" },
                  },
                ],
              },
              {
                userId: "user-3",
                displayName: "Zoe",
                avatarUrl: null,
                isViewer: false,
                owes: { currency: "EUR", minor: "0" },
                lent: { currency: "EUR", minor: "0" },
                relationships: [],
              },
              {
                userId: "user-2",
                displayName: "Alex",
                avatarUrl: null,
                isViewer: false,
                owes: { currency: "EUR", minor: "500" },
                lent: { currency: "EUR", minor: "0" },
                relationships: [
                  {
                    kind: "owes",
                    counterpartyId: "user-1",
                    counterpartyDisplayName: "Lasse",
                    counterpartyAvatarUrl: null,
                    amount: { currency: "EUR", minor: "500" },
                  },
                ],
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
          mutate: mockRemoveMutate,
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
    mockRemoveMutate.mockClear();
    jest.spyOn(Alert, "alert").mockClear();
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
    expect(view.getByText("€ · EUR")).toBeTruthy();
    expect(
      view.getByText("Share a reusable link valid for 7 days"),
    ).toBeTruthy();
    let editAncestor = view.getByTestId("edit-group").parent;
    let usesGroupColor = false;
    while (editAncestor) {
      if (editAncestor.props.seedColor === "#1764B0") {
        usesGroupColor = true;
        break;
      }
      editAncestor = editAncestor.parent;
    }
    expect(usesGroupColor).toBe(true);
    expect(view.queryByText(/All settled up/)).toBeNull();
    expect(view.queryByLabelText("Name")).toBeNull();
    expect(
      view.getAllByText("›", { includeHiddenElements: true }),
    ).toHaveLength(1);

    await fireEvent.press(view.getByTestId("edit-group"));

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

    expect(
      view.queryByText("Use fewer payments to settle the group"),
    ).toBeNull();
    const switchStyle = StyleSheet.flatten(
      view.getByLabelText("Simplify debts").props.style,
    );
    expect(switchStyle.alignSelf).toBe("center");
    expect(switchStyle.transform).toBeUndefined();

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
      color: "#1764B0",
      currency: "EUR",
      simplifyDebts: false,
    });
  });

  it("combines sorted members with balances, tap disclosures, and swipe removal", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(
      view
        .getAllByText(/^(Alex|Lasse \(You\)|Zoe)$/)
        .map((node) => node.props.children),
    ).toEqual(["Alex", "Lasse (You)", "Zoe"]);
    expect(view.getByText("Owes 5.00 €")).toBeTruthy();
    expect(view.getByText("Lent 5.00 €")).toBeTruthy();
    expect(view.getByText("Settled up")).toBeTruthy();
    expect(view.getByTestId("member-swipe-user-2")).toBeTruthy();
    expect(view.queryByTestId("member-swipe-user-1")).toBeNull();
    expect(view.getByLabelText("Remove Alex")).toBeTruthy();
    expect(view.getByLabelText("Remove Zoe")).toBeTruthy();

    const alexRow = view.getByLabelText("Alex. Owes 5.00 €");
    await fireEvent(alexRow, "touchStart", {
      nativeEvent: { pageX: 220, pageY: 50 },
    });
    await fireEvent(alexRow, "touchMove", {
      nativeEvent: { pageX: 160, pageY: 50 },
    });
    await fireEvent.press(alexRow);
    expect(view.queryByLabelText("Alex owes 5.00 € to you")).toBeNull();

    await fireEvent(alexRow, "touchStart", {
      nativeEvent: { pageX: 220, pageY: 50 },
    });
    await fireEvent.press(alexRow);
    expect(view.getByLabelText("Alex owes 5.00 € to you")).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Lasse (You). Lent 5.00 €"));
    expect(view.getAllByLabelText("Alex owes 5.00 € to you")).toHaveLength(2);

    await fireEvent.press(view.getByLabelText("Remove Alex"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Settle with Alex first",
      "A member can only be removed after their group balance reaches zero.",
      [{ text: "OK" }],
    );
    expect(mockRemoveMutate).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText("Remove Zoe"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Remove Zoe?",
      "They can rejoin later with a new invitation.",
      expect.any(Array),
    );
  });

});
