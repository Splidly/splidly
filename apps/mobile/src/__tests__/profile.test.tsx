import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import ProfileScreen from "../app/(tabs)/profile";

const mockDeleteAccount = jest.fn();
let mockDeleteMutationOptions:
  | {
      onError?: (
        error: Error,
        input: { confirmation: "DELETE"; leaveGroups?: boolean },
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
    replace: jest.fn(),
  },
}));

jest.mock("expo-notifications", () => ({
  unregisterForNotificationsAsync: jest.fn(),
}));

jest.mock("../lib/auth-client", () => ({
  authClient: {
    signOut: jest.fn(),
  },
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

  it("offers to leave every group before deleting the account", async () => {
    mockGroups = [{ id: "group-1" }, { id: "group-2" }];
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    pressAlertButton(0, "Delete");

    expect(alert).toHaveBeenNthCalledWith(
      2,
      "Leave groups and delete account?",
      expect.stringContaining("You're still a member of 2 groups."),
      expect.any(Array),
    );

    pressAlertButton(1, "Leave & Delete");
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
      leaveGroups: true,
    });
  });

  it("deletes directly after confirmation when no groups remain", async () => {
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    pressAlertButton(0, "Delete");

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
      leaveGroups: false,
    });
  });

  it("offers the shortcut when a concurrent membership blocks deletion", async () => {
    mockGroups = undefined;
    const view = await renderProfile();

    await fireEvent.press(view.getByText("Delete account"));
    pressAlertButton(0, "Delete");
    mockDeleteMutationOptions?.onError?.(
      new Error("Leave all groups before deleting your account"),
      { confirmation: "DELETE", leaveGroups: false },
    );

    expect(alert).toHaveBeenNthCalledWith(
      2,
      "Leave groups and delete account?",
      expect.stringContaining("one or more groups"),
      expect.any(Array),
    );
  });
});
