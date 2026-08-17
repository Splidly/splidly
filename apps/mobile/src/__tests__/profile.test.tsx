import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import ProfileScreen from "../app/(tabs)/profile";

const mockDeleteAccount = jest.fn();
let mockDeleteMutationOptions:
  | {
      onSuccess?: (result: {
        deleted: boolean;
        manualAppleRevocationRequired: boolean;
      }) => Promise<void>;
      onError?: (
        error: Error,
        input: { confirmation: "DELETE" },
      ) => void;
    }
  | undefined;
let mockGroups: { id: string }[] | undefined = [];

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    clear: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock("expo-notifications", () => ({
  unregisterForNotificationsAsync: jest.fn(),
}));

jest.mock("../lib/auth-client", () => ({
  authClient: {
    signOut: jest.fn(async () => ({ error: null })),
  },
}));

jest.mock("../lib/local-account-data", () => ({
  clearLocalAccountData: jest.fn(async () => {}),
  clearLocalAuthSession: jest.fn(async () => {}),
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
        useQuery: () => ({
          data: {
            userId: "user-1",
            displayName: "Lasse",
            homeCurrency: "EUR",
            notificationOnlyWhenInvolved: false,
            summarizeNotificationBursts: false,
          },
        }),
      },
      update: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: jest.fn(),
        }),
      },
      deleteAccount: {
        useMutation: (
          options: typeof mockDeleteMutationOptions,
        ) => {
          mockDeleteMutationOptions = options;
          return {
            error: null,
            isPending: false,
            mutate: mockDeleteAccount,
          };
        },
      },
    },
    groups: {
      list: {
        useQuery: () => ({
          data: mockGroups,
        }),
      },
    },
    push: {
      unregister: {
        useMutation: () => ({ mutateAsync: jest.fn() }),
      },
    },
    useUtils: () => ({
      friends: {
        list: {
          invalidate: jest.fn(),
        },
      },
      groups: {
        invalidate: jest.fn(),
      },
      profile: {
        me: {
          setData: jest.fn(),
        },
      },
    }),
  },
}));

function renderProfile() {
  return render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ProfileScreen />
    </SafeAreaInsetsContext.Provider>,
  );
}

describe("ProfileScreen account deletion", () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    mockGroups = [];
    mockDeleteAccount.mockClear();
    mockDeleteMutationOptions = undefined;
    alert = jest.spyOn(Alert, "alert").mockImplementation();
  });

  afterEach(() => {
    alert.mockRestore();
  });

  function pressAlertButton(callIndex: number, label: string) {
    const buttons = alert.mock.calls[callIndex]?.[2];
    const button = buttons?.find(
      (candidate: { text?: string }) => candidate.text === label,
    );
    if (!button?.onPress) {
      throw new Error(`Alert button "${label}" was not found`);
    }
    button.onPress();
  }

  it("deletes directly even when the user still belongs to groups", async () => {
    mockGroups = [{ id: "group-1" }, { id: "group-2" }];
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    expect(alert).toHaveBeenCalledWith(
      "Permanently delete account?",
      expect.stringContaining("Shared expenses and settlements remain"),
      expect.any(Array),
    );
    pressAlertButton(0, "Delete permanently");
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
    });
  });

  it("requires only one explicit destructive confirmation", async () => {
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    pressAlertButton(0, "Delete permanently");

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
    });
  });

  it("asks for a new sign-in when the session is not recent", async () => {
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    pressAlertButton(0, "Delete permanently");
    mockDeleteMutationOptions?.onError?.(
      new Error("Sign in again before deleting your account"),
      { confirmation: "DELETE" },
    );

    expect(alert).toHaveBeenNthCalledWith(
      2,
      "Sign in again",
      expect.stringContaining("For security"),
      expect.any(Array),
    );
  });

  it("clears protected local data after server-side deletion", async () => {
    await renderProfile();
    const { clearLocalAccountData } = jest.requireMock(
      "../lib/local-account-data",
    ) as { clearLocalAccountData: jest.Mock };
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock };
    };

    await mockDeleteMutationOptions?.onSuccess?.({
      deleted: true,
      manualAppleRevocationRequired: false,
    });

    expect(clearLocalAccountData).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/sign-in");
  });

  it("opens notification preferences without action chevrons on account rows", async () => {
    const view = await renderProfile();
    const { router } = jest.requireMock("expo-router") as {
      router: { push: jest.Mock };
    };

    await fireEvent.press(view.getByText("Notifications"));
    expect(router.push).toHaveBeenCalledWith("/profile/notifications");
    expect(view.queryByText("Changes save automatically")).toBeNull();
    expect(
      view.getAllByText("›", { includeHiddenElements: true }),
    ).toHaveLength(2);
  });
});
