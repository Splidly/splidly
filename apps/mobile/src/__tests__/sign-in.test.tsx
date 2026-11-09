import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import SignInScreen from "../app/sign-in";

const mockGoogleSignIn = jest.fn();
const mockAppleSignIn = jest.fn();
const mockSocialSignIn = jest.fn();
const mockSessionRefetch = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => {
  const { View, Text } = require("react-native");
  return {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn(async () => true),
      signIn: () => mockGoogleSignIn(),
    },
    GoogleSigninButton: Object.assign(
      (props: Record<string, unknown>) => <View {...props} accessibilityRole="button"><Text selectable={false}>Continue with Google</Text></View>,
      { Size: { Wide: 2 }, Color: { Light: "light", Dark: "dark" } },
    ),
  };
});

jest.mock("expo-apple-authentication", () => {
  const { View, Text } = require("react-native");
  return {
    AppleAuthenticationButton: (props: Record<string, unknown>) => <View {...props} accessibilityRole="button"><Text selectable={false}>Continue with Apple</Text></View>,
    AppleAuthenticationButtonType: { CONTINUE: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    signInAsync: () => mockAppleSignIn(),
    formatFullName: () => "Alex Morgan",
  };
});
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: jest.fn() }) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, refetch: mockSessionRefetch }),
    signIn: { social: (...args: unknown[]) => mockSocialSignIn(...args) },
  },
  signInAsDemo: jest.fn(async () => {}),
}));
jest.mock("../lib/trpc", () => ({
  api: { profile: { me: { useQuery: () => ({ data: undefined, isPending: false, error: null }) } } },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogleSignIn.mockReset().mockResolvedValue({ data: { idToken: "google-token" } });
  mockAppleSignIn.mockReset().mockResolvedValue({ identityToken: "apple-token", fullName: null });
  mockSocialSignIn.mockReset().mockResolvedValue({ error: null });
});

function fixture() {
  return <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><SignInScreen /></SafeAreaInsetsContext.Provider>;
}

it("lets a failed provider retry without losing the legal links or enabling text selection", async () => {
  mockGoogleSignIn.mockRejectedValueOnce(new Error("Google sign-in failed"));
  const view = await render(fixture());
  await fireEvent.press(view.getByTestId("sign-in-google"));
  await waitFor(() => expect(view.getByText("Google sign-in failed")).toBeTruthy());
  expect(view.getByText("Terms of Service").props.onPress).toEqual(expect.any(Function));
  expect(view.getByText("Privacy Notice").props.onPress).toEqual(expect.any(Function));
  expect(view.getByText("Legal notice")).toBeTruthy();
  await fireEvent.press(view.getByTestId("sign-in-google"));
  await waitFor(() => expect(mockSessionRefetch).toHaveBeenCalledTimes(1));
  expect(mockSocialSignIn).toHaveBeenCalledWith(expect.objectContaining({
    provider: "google", idToken: { token: "google-token" },
  }));
  expect(view.container.queryAll((node) => node.props.selectable === true)).toHaveLength(0);
});

if (process.env.EXPO_OS === "ios") {
  it("starts only one Apple sign-in when its native callback fires twice", async () => {
    let finish!: (value: { identityToken: string; fullName: null }) => void;
    mockAppleSignIn.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = await render(fixture());
    const press = view.getByTestId("sign-in-apple").props.onPress;
    await act(async () => { press(); press(); });
    expect(mockAppleSignIn).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText("Signing in")).toBeTruthy();
    await act(async () => finish({ identityToken: "apple-token", fullName: null }));
    await waitFor(() => expect(mockSessionRefetch).toHaveBeenCalledTimes(1));
  });
}
