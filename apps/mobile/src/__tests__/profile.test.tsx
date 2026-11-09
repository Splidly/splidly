import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import ProfileScreen from "../app/(tabs)/profile";
import { nativeProfileText, pressProfile, profileNode } from "../test-utils/native-profile";
import { getCurrencySelection, endCurrencySelection } from "../lib/currency-selection";

let viewConfig: jest.SpyInstance;
beforeEach(() => {
  viewConfig = jest.spyOn(globalThis.expo, "getViewConfig").mockReturnValue({
    validAttributes: {}, directEventTypes: {},
  });
});
afterEach(() => viewConfig.mockRestore());

jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  // Native Material palette lookup is unavailable in Jest.
  return { ...actual, Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View> };
});

const mockDeleteAccount = jest.fn();
const mockUpdateProfile = jest.fn();
const mockProfileQuery = jest.fn();
const mockQueryClient = {
  clear: jest.fn(),
  cancelQueries: jest.fn(async () => {}),
};
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
  useQueryClient: () => mockQueryClient,
}));

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
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
        useQuery: (...args: unknown[]) => {
          mockProfileQuery(...args);
          return ({
          data: {
            userId: "user-1",
            displayName: "Lasse",
            homeCurrency: "EUR",
            notificationOnlyWhenInvolved: false,
            summarizeNotificationBursts: false,
          },
          });
        },
      },
      update: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: mockUpdateProfile,
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
    mockUpdateProfile.mockClear();
    mockProfileQuery.mockClear();
    mockQueryClient.clear.mockClear();
    mockQueryClient.cancelQueries.mockClear();
    jest.requireMock("../lib/auth-client").authClient.signOut.mockReset().mockResolvedValue({ error: null });
    jest.requireMock("expo-router").router.replace.mockClear();
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

  it("cancels protected queries before logout and keeps them disabled while navigating away", async () => {
    const { authClient } = jest.requireMock("../lib/auth-client");
    const { router } = jest.requireMock("expo-router");
    let finish!: (result: { error: null }) => void;
    authClient.signOut.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = await renderProfile();
    await pressProfile(view, "profile-setting-signOut");
    await waitFor(() => expect(authClient.signOut).toHaveBeenCalledTimes(1));
    expect(mockProfileQuery).toHaveBeenLastCalledWith(undefined, { enabled: false });
    expect(mockQueryClient.cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(authClient.signOut.mock.invocationCallOrder[0]);
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => finish({ error: null }));
    expect(mockQueryClient.clear).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/sign-in");
    expect(mockProfileQuery).toHaveBeenLastCalledWith(undefined, { enabled: false });
    expect(view.queryByText("UNAUTHORIZED")).toBeNull();
  });

  it("shows real logout failures and re-enables the profile without clearing the session cache", async () => {
    const { authClient } = jest.requireMock("../lib/auth-client");
    const { router } = jest.requireMock("expo-router");
    authClient.signOut.mockResolvedValue({ error: { message: "Could not sign out" } });
    const view = await renderProfile();
    await pressProfile(view, "profile-setting-signOut");
    await waitFor(() => expect(view.getByText("Could not sign out")).toBeTruthy());
    expect(mockProfileQuery).toHaveBeenLastCalledWith(undefined, { enabled: true });
    expect(mockQueryClient.clear).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("deletes directly even when the user still belongs to groups", async () => {
    mockGroups = [{ id: "group-1" }, { id: "group-2" }];
    const view = await renderProfile();

    await pressProfile(view, "profile-setting-delete");
    expect(alert).toHaveBeenCalledWith(
      "Permanently delete account?",
      expect.stringContaining("Shared groups, expenses, settlements"),
      expect.any(Array),
    );
    pressAlertButton(0, "Delete permanently");
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
    });
  });

  it("requires only one explicit destructive confirmation", async () => {
    const view = await renderProfile();

    await pressProfile(view, "profile-setting-delete");
    pressAlertButton(0, "Delete permanently");

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).toHaveBeenCalledWith({
      confirmation: "DELETE",
    });
  });

  it("asks for a new sign-in when the session is not recent", async () => {
    const view = await renderProfile();

    await pressProfile(view, "profile-setting-delete");
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

    await pressProfile(view, "profile-setting-notifications");
    expect(router.push).toHaveBeenCalledWith("/profile/notifications");
    expect(view.queryByText("Changes save automatically")).toBeNull();
    for (const icon of ["signOut", "delete"]) {
      if (process.env.EXPO_OS === "ios") {
        const rows = view.getByTestId("native-activity-list").props.sections.flatMap((section: { rows: { key: string; settings: { showsDisclosure: boolean } }[] }) => section.rows);
        expect(rows.find((row: { key: string }) => row.key === `profile-setting-${icon}`).settings.showsDisclosure).toBe(false);
      } else {
        expect(profileNode(view, `profile-setting-${icon}`).queryAll((node) => node.props.systemName === "chevron.right")).toHaveLength(0);
      }
    }
  });

  it("puts iOS settings in native grouped cells instead of standalone styled cards", async () => {
    const view = await renderProfile();
    if (process.env.EXPO_OS !== "ios") {
      expect(view.queryByTestId("native-activity-list")).toBeNull();
      return;
    }
    const list = view.getByTestId("native-activity-list");
    expect(list.props.plain).toBe(false);
    expect(list.props.sections.slice(1).map((section: { headerTitle: string }) => section.headerTitle)).toEqual([
      "", "Preferences", "Legal & support", "Account",
    ]);
    expect(list.props.sections.slice(1).map((section: { key: string; rows: unknown[] }) => [section.key, section.rows.length])).toEqual([
      ["profile", 1], ["Preferences", 2], ["Legal & support", 4], ["Account", 2],
    ]);
    for (const section of list.props.sections.slice(1)) {
      for (const row of section.rows) {
        expect(row.nativeContent).toBe(true);
        expect(row.selectable).toBe(true);
        expect(row.canDelete).toBe(false);
        expect(row.settings).toEqual(expect.objectContaining({ title: expect.any(String), enabled: true }));
        expect(view.queryByTestId(row.key)).toBeNull();
        expect(view.queryByTestId(`${row.key}-highlight`)).toBeNull();
      }
    }
    expect(list.props.sections[2].footerTitle).toBe("Currency changes apply to new entries only. Historical balances stay in their original buckets.");
    expect(list.props.sections.at(-1).footerTitle).toMatch(/^Splidly/);
    expect(view.queryByTestId("native-activity-footer-Preferences")).toBeNull();
  });

  it("presents a read-only identity and opens the editor only once", async () => {
    const view = await renderProfile();
    const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
    router.push.mockClear();
    if (process.env.EXPO_OS === "ios") {
      expect(view.getByTestId("native-activity-list").props.sections[1].rows[0].settings).toMatchObject({
        identity: true, title: "Lasse", subtitle: "Edit name and photo", showsDisclosure: true,
      });
    } else expect(nativeProfileText(view, "Lasse")).toHaveLength(1);
    expect(view.queryByLabelText("Display name")).toBeNull();
    await pressProfile(view, "profile-identity");
    await pressProfile(view, "profile-identity");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/profile/edit");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("changes only the home currency through the shared currency picker", async () => {
    const view = await renderProfile();
    await pressProfile(view, "profile-setting-currency");
    const selection = getCurrencySelection();
    expect(selection?.value).toBe("EUR");
    selection?.onSelect("USD");
    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: "Lasse", homeCurrency: "USD" });
    endCurrencySelection(selection);
  });
});
