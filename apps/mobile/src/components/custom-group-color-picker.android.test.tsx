import { act, fireEvent, render } from "@testing-library/react-native";
import { CustomGroupColorPicker } from "./custom-group-color-picker.android";

jest.mock("@expo/ui/jetpack-compose", () => ({
  Host: ({ children }: { children: React.ReactNode }) => children,
}));

async function openPicker(onValueChange = jest.fn()) {
  const view = await render(<CustomGroupColorPicker value="#00749A" selected onValueChange={onValueChange} />);
  await fireEvent.press(view.getByLabelText("Custom group color"));
  const native = view.container.queryAll((node) => node.props.color === "#00749A")[0]!;
  expect(native).toBeDefined();
  return { view, native, onValueChange };
}

it("discards cancelled color drafts and reopens with the original color", async () => {
  const { view, native, onValueChange } = await openPicker();
  await fireEvent(native, "dismiss");
  expect(onValueChange).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText("Custom group color"));
  expect(view.container.queryAll((node) => node.props.color === "#00749A")).toHaveLength(1);
});

it("commits one valid color even if the native confirm event is repeated", async () => {
  const { native, onValueChange } = await openPicker();
  const confirm = native.props.onConfirm;
  await act(async () => {
    confirm({ nativeEvent: { color: "#FFCC00" } });
    confirm({ nativeEvent: { color: "#FFCC00" } });
  });
  expect(onValueChange).toHaveBeenCalledTimes(1);
  expect(onValueChange).toHaveBeenCalledWith("#FFCC00");
});

it("rejects invalid native color values", async () => {
  const { native, onValueChange } = await openPicker();
  await fireEvent(native, "confirm", { nativeEvent: { color: "not-a-color" } });
  expect(onValueChange).not.toHaveBeenCalled();
});
