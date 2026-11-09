import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import GroupSettingsScreen from "../app/(tabs)/groups/[id]/settings";

const mockUpdateMutate = jest.fn();
const mockNotificationMutate = jest.fn();
let mockSimplificationPending = false;
let mockAppNotificationsEnabled = true;
const mockRemoveMutate = jest.fn();
const mockArchiveMutate = jest.fn(async () => undefined);

jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  return { ...actual, Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View> };
});

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
          isPending: mockSimplificationPending,
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
          mutate: mockNotificationMutate,
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
        useQuery: () => ({ data: { userId: "user-1", notificationsEnabled: mockAppNotificationsEnabled } }),
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

(process.env.EXPO_OS === "android" ? describe.skip : describe)("GroupSettingsScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSimplificationPending = false;
    mockAppNotificationsEnabled = true;
    mockNotificationMutate.mockClear();
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

    const list = view.getByTestId("native-activity-list");
    const sections = list.props.sections.slice(1);
    expect(sections.map((section: { headerTitle: string }) => section.headerTitle)).toEqual([
      "", "Preferences", "Members (3)", "Group actions",
    ]);
    expect(sections[1].rows.map((row: { key: string }) => row.key)).toEqual(["group-notifications", "simplify-debts"]);
    expect(sections[1].rows[1].settings.infoMessage).toBeUndefined();
    expect(sections[1].footerTitle).toBe("Simplify debts reduces repayments without changing anyone’s net balance.");
    expect(sections[1].rows[1].settings.subtitle).toBeUndefined();
    expect(sections[2].footerTitle).toBe("Swipe to remove settled members.");
    expect(sections.every((section: { rows: { nativeContent: boolean; settings: unknown }[] }) =>
      section.rows.every(row => row.nativeContent && row.settings))).toBe(true);
    expect(sections[0].rows[0].settings).toMatchObject({
      title: "Lisbon", subtitle: "€ · EUR", identity: true, symbol: "airplane",
      avatarFallback: { initials: "", rounded: true, backgroundColor: expect.any(String), foregroundColor: expect.any(String) },
    });
    expect(sections[2].rows[0].settings).toMatchObject({ title: "Invite people", subtitle: "Link valid for 7 days" });
    expect(view.queryByLabelText("Name")).toBeNull();
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "edit-group" } });
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "edit-group" } });

    expect(mockPush).toHaveBeenCalledWith("/groups/group-1/edit");
    expect(mockPush).toHaveBeenCalledTimes(1);
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
      await fireEvent(view.getByTestId("native-activity-list"), "rowPress", { nativeEvent: { rowKey: "archive" } });
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

    const list = view.getByTestId("native-activity-list");
    expect(list.props.sections.find((section: { key: string }) => section.key === "preferences").rows[1].settings)
      .toMatchObject({ title: "Simplify debts", toggleValue: true, enabled: true });
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "simplify-debts" } });
    expect(view.getByTestId("native-activity-list").props.sections.find((section: { key: string }) => section.key === "preferences").rows[1].settings.toggleValue).toBe(false);

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

  it("uses native member disclosures and preserves swipe removal", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <GroupSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    const nativeList = view.getByTestId("native-activity-list");
    const rows = nativeList.props.sections.find((section: { key: string }) => section.key === "members").rows;
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
    expect(rows[1].settings).toMatchObject({ title: "Alex", value: "Owes 5.00 €", disclosure: true, showsDisclosure: false, details: [{ title: "Owes you", value: "5.00 €", tone: "negative" }] });
    expect(rows[1].settings.avatarFallback).toMatchObject({ initials: "A", backgroundColor: expect.any(String) });
    expect(rows[2].settings.avatarFallback).toMatchObject({ initials: "L" });
    expect(rows[3].settings.avatarFallback).toMatchObject({ initials: "Z" });
    expect(rows[2].settings).toMatchObject({ title: "Lasse (You)", value: "Lent 5.00 €" });
    expect(rows[3].settings).toMatchObject({ title: "Zoe", value: "Settled up" });
    expect(view.queryByText("No outstanding balances.")).toBeNull();
    expect(rows[1].selectable).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
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
  it("updates the native notification switch and respects the app-wide disabled state", async () => {
    const view = await render(<SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}><GroupSettingsScreen /></SafeAreaInsetsContext.Provider>);
    await fireEvent(view.getByTestId("native-activity-list"), "rowPress", { nativeEvent: { rowKey: "group-notifications" } });
    expect(mockNotificationMutate).toHaveBeenCalledWith({ groupId: "group-1", enabled: false });
    mockAppNotificationsEnabled = false;
    await view.rerender(<SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}><GroupSettingsScreen /></SafeAreaInsetsContext.Provider>);
    const list = view.getByTestId("native-activity-list");
    const section = list.props.sections.find((section: { key: string }) => section.key === "preferences");
    expect(section.rows[0]).toMatchObject({ selectable: false, settings: { enabled: false, toggleValue: false } });
    expect(section.footerTitle).toContain("Notifications are off in Profile > Notifications.");
    mockNotificationMutate.mockClear();
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "group-notifications" } });
    expect(mockNotificationMutate).not.toHaveBeenCalled();
  });

  it("disables the native debt switch during a save", async () => {
    mockSimplificationPending = true;
    const view = await render(<SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}><GroupSettingsScreen /></SafeAreaInsetsContext.Provider>);
    const list = view.getByTestId("native-activity-list");
    expect(list.props.sections.find((section: { key: string }) => section.key === "preferences").rows[1])
      .toMatchObject({ selectable: false, settings: { toggleValue: true, enabled: false } });
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "simplify-debts" } });
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

});

(process.env.EXPO_OS === "android" ? describe : describe.skip)("Android group settings", () => {
  it("preserves its summary, switches, member expansion and actions", async () => {
    mockPush.mockClear();
    mockUpdateMutate.mockClear();
    mockSimplificationPending = false;
    mockAppNotificationsEnabled = true;
    const view = await render(<SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}><GroupSettingsScreen /></SafeAreaInsetsContext.Provider>);
    expect(view.getByText("Lisbon")).toBeTruthy();
    expect(view.getByText("€ · EUR")).toBeTruthy();
    expect(view.getByLabelText("Simplify debts")).toBeTruthy();
    await fireEvent(view.getByLabelText("Simplify debts"), "valueChange", false);
    expect(mockUpdateMutate).toHaveBeenCalledWith(expect.objectContaining({ simplifyDebts: false }));
    expect(view.getByLabelText("Notifications for Lisbon")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Alex. Owes 5.00 €"));
    expect(view.getByText("Owes you")).toBeTruthy();
    expect(view.getByText("Archive group")).toBeTruthy();
    mockArchiveMutate.mockClear();
    await fireEvent.press(view.getByText("Archive group"));
    expect(mockArchiveMutate).toHaveBeenCalledWith({ groupId: "group-1", expectedVersion: 3 });
  });
});
