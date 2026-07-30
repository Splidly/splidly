import { fireEvent, render } from "@testing-library/react-native";
import { GroupColorPicker } from "./group-color-picker";

describe("GroupColorPicker", () => {
  it("renders every preset horizontally and selects a color", async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <GroupColorPicker
        value="#4745B8"
        onValueChange={onValueChange}
      />,
    );

    const selected = view.getByLabelText("Group color #4745B8");
    expect(selected.props.accessibilityState).toEqual({ selected: true });

    fireEvent.press(view.getByLabelText("Group color #087867"));
    expect(onValueChange).toHaveBeenCalledWith("#087867");
  });
});
