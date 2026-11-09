import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { GroupsCollection } from "./groups-collection";
import { FriendsCollection } from "./friends-collection";

const mockPush = jest.fn();
const mockArchive = jest.fn(async () => undefined);
const mockRestore = jest.fn(async () => undefined);
const mockGroupQuery = jest.fn();
const mockFriendQuery = jest.fn();
jest.mock("../lib/use-push-once", () => ({ usePushOnce: () => mockPush }));
jest.mock("../lib/share-invite", () => ({ shareInvite: jest.fn() }));
jest.mock("expo-router", () => {
  const Toolbar = Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Button: () => null },
  );
  return { Stack: { Screen: () => null, Toolbar }, useFocusEffect: jest.fn() };
});
jest.mock("../lib/trpc", () => ({
  api: {
    useUtils: () => ({
      groups: {
        list: { invalidate: jest.fn() },
        archivedCount: { invalidate: jest.fn() },
      },
      friends: {
        list: { invalidate: jest.fn() },
        archivedCount: { invalidate: jest.fn() },
      },
    }),
    groups: {
      archivedCount: { useQuery: () => ({ data: 2, refetch: jest.fn() }) },
      list: { useQuery: (...args: unknown[]) => mockGroupQuery(...args) },
      archive: {
        useMutation: () => ({ mutateAsync: mockArchive, isPending: false }),
      },
      restore: {
        useMutation: () => ({ mutateAsync: mockRestore, isPending: false }),
      },
    },
    friends: {
      archivedCount: { useQuery: () => ({ data: 2, refetch: jest.fn() }) },
      list: { useQuery: (...args: unknown[]) => mockFriendQuery(...args) },
      archive: {
        useMutation: () => ({ mutateAsync: mockArchive, isPending: false }),
      },
      restore: {
        useMutation: () => ({ mutateAsync: mockRestore, isPending: false }),
      },
    },
    invites: {
      create: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

const group = {
  id: "group",
  name: "Trip",
  iconKey: "trip",
  color: null,
  imageUrl: null,
  balance: { currency: "EUR", minor: "0" },
  memberBalances: [],
  version: 3,
};
const friend = {
  friendship: { id: "friendship" },
  friend: { userId: "friend", displayName: "Alex", avatarUrl: null },
  balances: [],
  canArchive: true,
};
const query = (data: unknown[]) => ({
  data,
  isPending: false,
  isRefetching: false,
  refetch: jest.fn(),
});
function fixture(content: React.ReactNode) {
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {content}
    </SafeAreaInsetsContext.Provider>
  );
}

describe("personal archive collections", () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockGroupQuery.mockReturnValue(query([group]));
    mockFriendQuery.mockReturnValue(query([friend]));
  });
  afterEach(() => alert.mockRestore());

  it("keeps Archived Groups reachable even when the active list is empty", async () => {
      mockGroupQuery.mockReturnValue(query([]));
      mockFriendQuery.mockReturnValue(query([]));
      const view = await render(
        fixture(<GroupsCollection />),
      );
      expect(view.getByTestId("archive-link").props.modifiers).toContainEqual(
        expect.objectContaining({ $type: "accessibilityLabel", label: "Archived Groups, 2" }),
      );
      await fireEvent(view.getByTestId("archive-link"), "buttonPress");
      expect(mockPush).toHaveBeenCalledWith("/groups/archived");
    },
  );

  it("archives and restores groups through the shared native swipe", async () => {
      for (const archived of [false, true]) {
        const view = await render(
          fixture(<GroupsCollection archived={archived} />),
        );
        expect(mockGroupQuery).toHaveBeenLastCalledWith(archived ? { archived: true } : undefined);
        const list = view.getByTestId("native-activity-list");
        expect(list.props.plain).toBe(true);
        expect(
          view.queryByTestId("swipe-row-group"),
        ).toBeNull();
        expect(list.props.sections[1].rows[0]).toMatchObject({
          canDelete: true,
          selectable: true,
          actionTitle: archived ? "Restore" : "Archive",
          ...(!archived ? { actionColor: "#FF9500" } : {}),
          actionIcon: archived ? "arrow.uturn.backward" : "archivebox",
        });
        const button = view.getByTestId("activity-group-group");
        expect(
          button.queryAll(
            (node) => node.props.text === "Trip",
          ),
        ).toHaveLength(1);
        expect(typeof button.props.onButtonPress).toBe("function");
        expect(
          button.queryAll(
            (node) =>
              typeof node.props.onPress === "function" ||
              node.props.matchContents !== undefined,
          ),
        ).toHaveLength(0);
        let pending!: Promise<void>;
        await act(() => {
          pending = list.props.onDeleteRequested({
            nativeEvent: {
              requestId: "action",
              rowKey: "group",
            },
          });
        });
        expect(mockPush).not.toHaveBeenCalled();
        await act(async () => {
          await pending;
        });
        expect(alert).not.toHaveBeenCalled();
        expect(archived ? mockRestore : mockArchive).toHaveBeenLastCalledWith(
          { groupId: "group", ...(!archived ? { expectedVersion: 3 } : {}) },
        );
        expect(list.props.completion).toEqual({
          requestId: "action",
          deleted: true,
        });
        if (archived) expect(view.queryByText("Archived Groups")).toBeNull();
        await view.unmount();
      }
    },
  );

  it("opens a group through its native cell tap and preview", async () => {
    const view = await render(fixture(<GroupsCollection />));
    const list = view.getByTestId("native-activity-list");
    expect(list.props.sections[1].rows[0].selectable).toBe(true);
    await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "group" } });
    expect(mockPush).toHaveBeenLastCalledWith("/groups/group");
    mockPush.mockClear();
    await fireEvent(list, "previewOpen", { nativeEvent: { rowKey: "group" } });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/groups/group");
  });
});


describe("friends grouped by outstanding balances", () => {
  const openFriend = {
    ...friend,
    friendship: { id: "open-friendship", archivedByLowAt: new Date() },
    friend: { userId: "open-friend", displayName: "Sam", avatarUrl: null },
    canArchive: false,
    balances: [{
      contextType: "friend",
      viewerAmount: { currency: "EUR", minor: "1000" },
      canonicalAmount: { currency: "EUR", minor: "1000" },
      counterpartyAmount: { currency: "EUR", minor: "1000" },
    }],
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockFriendQuery.mockReturnValue(query([friend, openFriend]));
  });

  it("shows only open friends and links to the automatically settled collection", async () => {
    const view = await render(fixture(<FriendsCollection />));
    expect(mockFriendQuery).toHaveBeenCalledWith({ includeArchived: true });
    expect(view.getByTestId("activity-friend-open-friend")).toBeTruthy();
    expect(view.queryByTestId("activity-friend-friend")).toBeNull();
    expect(view.getByTestId("archive-link").props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "accessibilityLabel", label: "Settled Friends, 1" }),
    );
    expect(view.getByTestId("activity-date-label-friends").props.children).toBe("1 friend");
    expect(view.getByTestId("native-activity-list").props.sections[1].rows[0]).toMatchObject({
      canDelete: false,
      nativeContent: true,
      selectable: true,
    });
    await fireEvent(view.getByTestId("archive-link"), "buttonPress");
    expect(mockPush).toHaveBeenCalledWith("/friends/archived");
  });

  it("shows settled friends without manual archive or restore actions", async () => {
    const view = await render(fixture(<FriendsCollection settled />));
    expect(view.getByTestId("activity-friend-friend")).toBeTruthy();
    expect(view.queryByTestId("activity-friend-open-friend")).toBeNull();
    const list = view.getByTestId("native-activity-list");
    expect(list.props.sections[1].rows[0].canDelete).toBe(false);
    await fireEvent(view.getByTestId("activity-friend-friend"), "buttonPress");
    expect(mockPush).toHaveBeenCalledWith("/friends/friendship");
    expect(mockArchive).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("keeps settled contacts reachable when no outstanding balances remain", async () => {
    mockFriendQuery.mockReturnValue(query([friend]));
    const view = await render(fixture(<FriendsCollection />));
    expect(view.getByText("All settled up")).toBeTruthy();
    expect(view.getByTestId("archive-link").props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "accessibilityLabel", label: "Settled Friends, 1" }),
    );
    expect(view.queryByTestId("activity-friend-friend")).toBeNull();
  });

  it("moves a contact automatically after settling and after a new expense", async () => {
    const view = await render(fixture(<FriendsCollection />));
    expect(view.getByTestId("activity-friend-open-friend")).toBeTruthy();
    mockFriendQuery.mockReturnValue(query([friend, { ...openFriend, canArchive: true, balances: [] }]));
    await view.rerender(fixture(<FriendsCollection />));
    expect(view.queryByTestId("activity-friend-open-friend")).toBeNull();
    expect(view.getByTestId("archive-link").props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "accessibilityLabel", label: "Settled Friends, 2" }),
    );
    mockFriendQuery.mockReturnValue(query([friend, openFriend]));
    await view.rerender(fixture(<FriendsCollection />));
    expect(view.getByTestId("activity-friend-open-friend")).toBeTruthy();
    expect(view.getByTestId("archive-link").props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "accessibilityLabel", label: "Settled Friends, 1" }),
    );
  });

  it("keeps a rounding remainder visible even when the viewer amount rounds to zero", async () => {
    mockFriendQuery.mockReturnValue(query([{
      ...openFriend,
      balances: [{ ...openFriend.balances[0], viewerAmount: { currency: "JPY", minor: "0" }, canonicalAmount: { currency: "EUR", minor: "1" } }],
    }]));
    const view = await render(fixture(<FriendsCollection />));
    const row = view.getByTestId("activity-friend-open-friend");
    expect(row.queryAll((node) => node.props.text === "0.01 €")).toHaveLength(1);
    expect(row.queryAll((node) => node.props.text === "Settled")).toHaveLength(0);
  });
});

describe("collection shortcuts during loading", () => {
  it.each(["friends", "groups"])(
    "waits for the %s list, including empty results, and stays visible during refresh",
    async (kind) => {
      const listQuery = kind === "friends" ? mockFriendQuery : mockGroupQuery;
      const label = kind === "friends" ? "Settled Friends" : "Archived Groups";
      const content = () => kind === "friends" ? <FriendsCollection /> : <GroupsCollection />;
      listQuery.mockReturnValue({ ...query([]), data: undefined, isPending: true });
      const view = await render(fixture(content()));
      expect(view.queryByTestId("archive-link")).toBeNull();

      listQuery.mockReturnValue({ ...query([]), data: undefined, error: new Error("Offline") });
      await view.rerender(fixture(content()));
      expect(view.queryByTestId("archive-link")).toBeNull();

      listQuery.mockReturnValue(query([]));
      await view.rerender(fixture(content()));
      expect(view.getByTestId("archive-link").queryAll((node) => node.props.text === label)).toHaveLength(1);

      listQuery.mockReturnValue({ ...query([]), isRefetching: true });
      await view.rerender(fixture(content()));
      expect(view.getByTestId("archive-link").queryAll((node) => node.props.text === label)).toHaveLength(1);
    },
  );
});
