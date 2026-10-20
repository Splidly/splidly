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

  it.each(["Groups", "Friends"])(
    "keeps Archived %s reachable even when the active list is empty",
    async (kind) => {
      mockGroupQuery.mockReturnValue(query([]));
      mockFriendQuery.mockReturnValue(query([]));
      const view = await render(
        fixture(
          kind === "Groups" ? <GroupsCollection /> : <FriendsCollection />,
        ),
      );
      expect(view.getByLabelText(`Archived ${kind}, 2`)).toBeTruthy();
      await fireEvent.press(view.getByText(`Archived ${kind}`));
      expect(mockPush).toHaveBeenCalledWith(`/${kind.toLowerCase()}/archived`);
    },
  );

  it.each(["Groups", "Friends"])(
    "archives and restores %s through the shared native swipe",
    async (kind) => {
      const isGroup = kind === "Groups";
      for (const archived of [false, true]) {
        const view = await render(
          fixture(
            isGroup ? (
              <GroupsCollection archived={archived} />
            ) : (
              <FriendsCollection archived={archived} />
            ),
          ),
        );
        expect(
          isGroup ? mockGroupQuery : mockFriendQuery,
        ).toHaveBeenLastCalledWith(archived ? { archived: true } : undefined);
        const list = view.getByTestId("native-activity-list");
        expect(list.props.plain).toBe(isGroup);
        expect(
          view.queryByTestId(`swipe-row-${isGroup ? "group" : "friendship"}`),
        ).toBeNull();
        expect(list.props.sections[1].rows[0]).toMatchObject({
          canDelete: true,
          actionTitle: archived ? "Restore" : "Archive",
          ...(!archived ? { actionColor: "#FF9500" } : {}),
          actionIcon: archived ? "arrow.uturn.backward" : "archivebox",
        });
        const button = view.getByTestId(
          isGroup ? "activity-group-group" : "activity-friend-friend",
        );
        expect(
          button.queryAll(
            (node) => node.props.text === (isGroup ? "Trip" : "Alex"),
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
              rowKey: isGroup ? "group" : "friendship",
            },
          });
        });
        expect(mockPush).not.toHaveBeenCalled();
        await act(async () => {
          await pending;
        });
        expect(alert).not.toHaveBeenCalled();
        expect(archived ? mockRestore : mockArchive).toHaveBeenLastCalledWith(
          isGroup
            ? { groupId: "group", ...(!archived ? { expectedVersion: 3 } : {}) }
            : { friendshipId: "friendship" },
        );
        expect(list.props.completion).toEqual({
          requestId: "action",
          deleted: true,
        });
        if (archived) expect(view.queryByText(`Archived ${kind}`)).toBeNull();
        await view.unmount();
      }
    },
  );
});
