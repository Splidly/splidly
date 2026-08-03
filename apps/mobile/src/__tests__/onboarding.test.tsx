import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import OnboardingScreen from "../app/onboarding";

let mockProfileData: {
  displayName: string;
  homeCurrency: string;
};

jest.mock("expo-router", () => ({
  router: {
    dismissAll: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useNavigation: () => ({
    dispatch: jest.fn(),
  }),
}));

jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ currencyCode: "USD" }],
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
          data: mockProfileData,
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
        useMutation: () => ({
          error: null,
          isPending: false,
          mutateAsync: jest.fn(),
        }),
      },
    },
    useUtils: () => ({
      invalidate: jest.fn(),
      profile: {
        me: {
          invalidate: jest.fn(),
        },
      },
    }),
  },
}));

describe("OnboardingScreen", () => {
  beforeEach(() => {
    mockProfileData = {
      displayName: "New user",
      homeCurrency: "EUR",
    };
  });

  it("preserves an intentionally empty display name draft", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <OnboardingScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    const input = view.getByLabelText("Display name");
    expect(input.props.value).toBe("");
    expect(input.props.autoFocus).toBeUndefined();

    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    expect(scrollView).toBeDefined();
    expect(scrollView?.props.scrollEnabled).toBeUndefined();
    expect(
      StyleSheet.flatten(scrollView?.props.contentContainerStyle).flexGrow,
    ).toBeUndefined();

    await fireEvent.changeText(input, "");

    expect(view.getByLabelText("Display name").props.value).toBe("");
    expect(view.getByLabelText("Home currency").props.children).toBe("USD");
  });

  it("prefills a display name supplied by the identity provider", async () => {
    mockProfileData.displayName = "Lasse Petzel";
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <OnboardingScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(view.getByLabelText("Display name").props.value).toBe(
      "Lasse Petzel",
    );
    expect(view.getByLabelText("Display name").props.autoFocus).toBeUndefined();
  });
});
