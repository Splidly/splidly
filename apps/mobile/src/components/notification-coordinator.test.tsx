import { act, render, waitFor } from "@testing-library/react-native";
import type * as NotificationsType from "expo-notifications";

const mockPush = jest.fn();
const mockClearLastResponse = jest.fn(() => Promise.resolve());
const mockGetLastResponse = jest.fn();
const mockReceivedListeners: Array<
  (notification: NotificationsType.Notification) => void
> = [];
const mockResponseListeners: Array<
  (response: NotificationsType.NotificationResponse) => void
> = [];
let mockPathname = "/";

jest.mock("expo-router", () => ({
  router: { push: mockPush },
  usePathname: () => mockPathname,
}));

jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    EPHEMERAL: 4,
    NOT_DETERMINED: 0,
    PROVISIONAL: 3,
  },
  addNotificationReceivedListener: jest.fn(
    (listener: (notification: NotificationsType.Notification) => void) => {
      mockReceivedListeners.push(listener);
      return { remove: jest.fn() };
    },
  ),
  addNotificationResponseReceivedListener: jest.fn(
    (
      listener: (response: NotificationsType.NotificationResponse) => void,
    ) => {
      mockResponseListeners.push(listener);
      return { remove: jest.fn() };
    },
  ),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponseAsync: mockClearLastResponse,
  getDevicePushTokenAsync: jest.fn(() =>
    Promise.resolve({ type: "ios", data: "device-token" }),
  ),
  getLastNotificationResponseAsync: mockGetLastResponse,
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ ios: { status: 2 } }),
  ),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
  },
}));

jest.mock("../lib/apns-environment", () => ({
  getApnsEnvironment: jest.fn(() => Promise.resolve("development")),
}));

jest.mock("../lib/push-installation", () => ({
  getPushInstallationId: jest.fn(() => Promise.resolve("installation-1")),
}));

const mockInvalidateExpense = jest.fn(() => Promise.resolve());

jest.mock("../lib/trpc", () => ({
  api: {
    profile: {
      me: {
        useQuery: () => ({ data: { onboardedAt: new Date() } }),
      },
    },
    push: {
      register: {
        useMutation: () => ({ mutateAsync: jest.fn(() => Promise.resolve()) }),
      },
    },
    useUtils: () => ({
      expenses: {
        detail: { invalidate: mockInvalidateExpense },
      },
      friends: {
        list: { invalidate: jest.fn(() => Promise.resolve()) },
      },
      groups: {
        balances: { invalidate: jest.fn(() => Promise.resolve()) },
        detail: { invalidate: jest.fn(() => Promise.resolve()) },
        list: { invalidate: jest.fn(() => Promise.resolve()) },
      },
    }),
  },
}));

const { NotificationCoordinator } = require("./notification-coordinator") as
  typeof import("./notification-coordinator");

function notificationResponse(id: string, expenseId: string) {
  return {
    actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
    notification: {
      date: Date.now(),
      request: {
        identifier: id,
        content: {
          title: "Expense updated",
          body: null,
          data: {
            eventType: "expense.updated",
            expenseId,
            expenseVersion: "2",
            groupId: "group-1",
          },
        },
        trigger: null,
      },
    },
  } as unknown as NotificationsType.NotificationResponse;
}

describe("NotificationCoordinator", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockPush.mockClear();
    mockClearLastResponse.mockClear();
    mockGetLastResponse.mockReset();
    mockReceivedListeners.length = 0;
    mockResponseListeners.length = 0;
    mockInvalidateExpense.mockClear();
  });

  it("waits for startup routing before opening a cold-start notification", async () => {
    mockGetLastResponse.mockResolvedValue(
      notificationResponse("notification-1", "expense-1"),
    );
    const view = await render(<NotificationCoordinator />);

    await waitFor(() => expect(mockGetLastResponse).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();

    mockPathname = "/friends";
    await act(async () => {
      await view.rerender(<NotificationCoordinator />);
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/expense/expense-1"),
    );
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
  });

  it("uses each tapped notification's own expense", async () => {
    mockPathname = "/friends";
    mockGetLastResponse.mockResolvedValue(null);
    await render(<NotificationCoordinator />);

    await waitFor(() => expect(mockResponseListeners).toHaveLength(1));
    await act(async () => {
      mockResponseListeners[0]?.(
        notificationResponse("notification-1", "expense-1"),
      );
    });
    await waitFor(() =>
      expect(mockPush).toHaveBeenLastCalledWith("/expense/expense-1"),
    );

    await act(async () => {
      mockResponseListeners[0]?.(
        notificationResponse("notification-2", "expense-2"),
      );
    });
    await waitFor(() =>
      expect(mockPush).toHaveBeenLastCalledWith("/expense/expense-2"),
    );
    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});
