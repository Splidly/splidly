import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import NotificationSettingsScreen from "../app/(tabs)/profile/notifications";

const mockUpdate = jest.fn();

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
  }) => (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
  );
  return {
    router: { back: jest.fn() },
    Stack: { Screen, Toolbar },
  };
});

jest.mock("../lib/trpc", () => ({
  api: {
    profile: {
      me: {
        useQuery: () => ({
          data: {
            userId: "user-1",
            notificationOnlyWhenInvolved: false,
            summarizeNotificationBursts: false,
          },
          error: null,
          isPending: false,
        }),
      },
      updateNotificationPreferences: {
        useMutation: () => ({
          error: null,
          isPending: false,
          mutate: mockUpdate,
        }),
      },
    },
    useUtils: () => ({
      profile: { me: { setData: jest.fn() } },
    }),
  },
}));

describe("notification settings", () => {
  beforeEach(() => mockUpdate.mockClear());

  it("saves both preferences from the dedicated sheet", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <NotificationSettingsScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    await fireEvent(
      view.getByLabelText("Only when involved"),
      "valueChange",
      true,
    );
    expect(mockUpdate).toHaveBeenLastCalledWith({
      onlyWhenInvolved: true,
      summarizeBursts: false,
    });

    await fireEvent(
      view.getByLabelText("Smart summaries"),
      "valueChange",
      true,
    );
    expect(mockUpdate).toHaveBeenLastCalledWith({
      onlyWhenInvolved: true,
      summarizeBursts: true,
    });
  });
});
