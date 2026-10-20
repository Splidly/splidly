import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupSettingsScreen from "../app/(tabs)/groups/[id]/settings";

const mockUpdateMutate = jest.fn();
const mockRemoveMutate = jest.fn();
const mockArchiveMutate = jest.fn(async () => undefined);

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
  }) => <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />;
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
        archivedCount: { invalidate: jest.fn() },
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
            notificationsEnabled: true,
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
          mutateAsync: mockRemoveMutate,
          error: null,
          isPending: false,
        }),
      },
      setNotificationPreference: {
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
        useMutation: () => ({
          mutate: jest.fn(),
          mutateAsync: mockArchiveMutate,
          error: null,
        }),
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
      view
        .getByTestId("activity-member-invite")
        .queryAll(
          (node) =>
            node.props.text === "Share a reusable link valid for 7 days",
        ),
    ).toHaveLength(1);
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
      view.queryAllByText("›", { includeHiddenElements: true }),
    ).toHaveLength(0);

    await fireEvent.press(view.getByTestId("edit-group"));

    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/edit");
  });

  it("archives immediately from settings without showing a confirmation", async () => {
    mockArchiveMutate.mockClear();
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByText("Archive group"));
      expect(mockArchiveMutate).toHaveBeenCalledWith({
        groupId: "group-1",
        expectedVersion: 3,
      });
      expect(alert).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
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

    const nativeList = view.getByTestId("native-activity-list");
    const rows = nativeList.props.sections[1].rows;
    expect(rows.map((row: { key: string }) => row.key)).toEqual([
      "invite",
      "user-2",
      "user-1",
      "user-3",
    ]);
    expect(rows.map((row: { canDelete: boolean }) => row.canDelete)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    expect(
      rows.every((row: { nativeContent: boolean }) => row.nativeContent),
    ).toBe(true);
    expect(rows[1]).toMatchObject({
      actionTitle: "Remove",
      actionIcon: "person.badge.minus",
    });
    expect(rows[1].actionColor).toBeUndefined();
    const alexRow = view.getByTestId("activity-member-user-2");
    expect(
      alexRow.queryAll(
        (node) =>
          typeof node.props.onPress === "function" ||
          node.props.matchContents !== undefined,
      ),
    ).toHaveLength(0);
    const textCount = (text: string) =>
      view.container.queryAll((node) => node.props.text === text).length;
    expect(textCount("Owes 5.00 €")).toBe(1);
    expect(textCount("Lent 5.00 €")).toBe(1);
    expect(textCount("Settled up")).toBe(1);
    expect(textCount("Alex owes 5.00 € to you")).toBe(0);
    await fireEvent(alexRow, "buttonPress");
    expect(textCount("Alex owes 5.00 € to you")).toBe(1);
    await fireEvent(view.getByTestId("activity-member-user-1"), "buttonPress");
    expect(textCount("Alex owes 5.00 € to you")).toBe(2);
    await fireEvent(nativeList, "deleteRequested", {
      nativeEvent: { rowKey: "user-2", requestId: "remove-alex" },
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Settle with Alex first",
      "A member can only be removed after their group balance reaches zero.",
    );
    expect(mockRemoveMutate).not.toHaveBeenCalled();

    let removal!: Promise<void>;
    await act(() => {
      removal = nativeList.props.onDeleteRequested({
        nativeEvent: { rowKey: "user-3", requestId: "remove-zoe" },
      });
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Remove Zoe?",
      "They can rejoin later with a new invitation.",
      expect.any(Array),
      expect.objectContaining({ cancelable: true }),
    );
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await act(async () => {
      buttons[0].onPress();
      await removal;
    });
    expect(nativeList.props.completion).toEqual({
      requestId: "remove-zoe",
      deleted: false,
    });
  });
});
