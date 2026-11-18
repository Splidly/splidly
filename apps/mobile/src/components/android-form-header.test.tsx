import { fireEvent, render } from "@testing-library/react-native";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { BackHandler, Keyboard, StyleSheet } from "react-native";
import { AndroidFormHeader } from "./android-form-header";

jest.mock("expo-router", () => ({
  Stack: { Screen: jest.fn(() => null) },
  router: { back: jest.fn() },
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

const androidIt = process.env.EXPO_OS === "android" ? it : it.skip;
const iosIt = process.env.EXPO_OS === "ios" ? it : it.skip;
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

androidIt("keeps Android form navigation and disabled save actions in the native header", async () => {
  const close = jest.fn();
  const save = jest.fn();
  await render(<AndroidFormHeader title="Split expense" closeLabel="Cancel split" onClose={close}
    action={{ label: "Save", onPress: save, disabled: true }} />);
  const options = jest.mocked(Stack.Screen).mock.calls[0]![0].options as {
    headerShown: boolean;
    headerTransparent: boolean;
    headerLeft: () => ReactNode;
    headerRight: () => ReactNode;
  };
  expect(options.headerShown).toBe(true);
  expect(options.headerTransparent).toBe(false);
  const view = await render(<>{options.headerLeft()}{options.headerRight()}</>);
  const cancel = view.getByLabelText("Cancel split");
  expect(StyleSheet.flatten(cancel.props.style)).toMatchObject({ minWidth: 48, minHeight: 48 });
  await fireEvent.press(cancel);
  await fireEvent.press(cancel);
  await fireEvent.press(view.getByLabelText("Save"));
  expect(close).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(view.getByText("Save").props.selectable).toBe(false);
});

iosIt("leaves the iOS header unchanged", async () => {
  await render(<AndroidFormHeader title="Add expense" />);
  expect(Stack.Screen).not.toHaveBeenCalled();
});

androidIt("dismisses the Android keyboard before allowing system Back to leave a draft", async () => {
  let handleBack: (() => boolean | null | undefined) | undefined;
  const remove = jest.fn();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    handleBack = () => handler({ type: "hardwareBackPress", timeStamp: Date.now() });
    return { remove };
  });
  const visible = jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
  const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
  const close = jest.fn();
  const view = await render(<AndroidFormHeader title="Add expense" onClose={close} />);
  expect(handleBack?.()).toBe(true);
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  visible.mockReturnValue(false);
  expect(handleBack?.()).toBe(false);
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
