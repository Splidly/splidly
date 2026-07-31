import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GroupColorPicker } from "./group-color-picker";

describe("GroupColorPicker", () => {
  it("starts with the opening color and selects another color", async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <GroupColorPicker
        value="#087867"
        onValueChange={onValueChange}
      />,
    );

    const selected = view.getByLabelText("Group color #087867");
    expect(selected.props.accessibilityState).toEqual({ selected: true });
    expect(
      StyleSheet.flatten(view.getByTestId("group-color-picker").props.style),
    ).toEqual(expect.objectContaining({ paddingHorizontal: 16 }));
    expect(
      view.getAllByRole("button")[0]?.props.accessibilityLabel,
    ).toBe("Group color #087867");

    await fireEvent.press(view.getByLabelText("Group color #4745B8"));
    expect(onValueChange).toHaveBeenCalledWith("#4745B8");
  });

  it("shows a trailing fade only while more colors remain", async () => {
    const view = await render(
      <GroupColorPicker
        value="#4745B8"
        onValueChange={jest.fn()}
      />,
    );
    const scroll = view.getByTestId("group-color-scroll");

    await fireEvent(view.getByTestId("group-color-palette"), "layout", {
      nativeEvent: { layout: { width: 180 } },
    });
    await fireEvent(scroll, "contentSizeChange", 600, 44);
    expect(
      StyleSheet.flatten(
        view.getByTestId("group-color-overflow").props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        width: 26,
        experimental_backgroundImage:
          "linear-gradient(to right, #FFFFFF00 0%, #FFFFFF 88%)",
      }),
    );

    await fireEvent.scroll(scroll, {
      nativeEvent: { contentOffset: { x: 420 } },
    });
    expect(view.queryByTestId("group-color-overflow")).toBeNull();
  });
});
