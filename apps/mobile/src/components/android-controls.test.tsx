import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";
import { AndroidMenuTrigger } from "./android-menu-trigger";
import { AndroidSheetActions, HeaderButton } from "./ui";

const androidIt = process.env.EXPO_OS === "android" ? it : it.skip;
const iosIt = process.env.EXPO_OS === "ios" ? it : it.skip;

androidIt("keeps Android sheet actions visible, reachable and disabled when saving", async () => {
  const close = jest.fn();
  const save = jest.fn();
  const view = await render(
    <AndroidSheetActions>
      <HeaderButton label="Close sheet" glyph="×" onPress={close} />
      <HeaderButton label="Save sheet" glyph="Done" onPress={save} disabled />
    </AndroidSheetActions>,
  );
  const button = view.getByLabelText("Close sheet");
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minWidth: 48, minHeight: 48 });
  await fireEvent.press(button);
  await fireEvent.press(view.getByLabelText("Save sheet"));
  expect(close).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(view.getByText("×").props.selectable).toBe(false);
});

iosIt("leaves iOS sheet controls to the native header", async () => {
  const view = await render(<AndroidSheetActions><Text>Android action</Text></AndroidSheetActions>);
  expect(view.queryByText("Android action")).toBeNull();
});

androidIt("makes Android menu icon content pointer-transparent without nesting a pressable", async () => {
  const view = await render(<AndroidMenuTrigger><View testID="native-icon" /></AndroidMenuTrigger>);
  const trigger = view.getByTestId("native-icon").parent!;
  expect(trigger.props.pointerEvents).toBe("none");
  expect(StyleSheet.flatten(trigger.props.style)).toMatchObject({ minWidth: 48, minHeight: 48 });
});
