import { fireEvent, render } from "@testing-library/react-native";
import { MemberSortButton } from "./member-sort-button.ios";

it("keeps the native sort selection and forwards each option", async () => {
  const onValueChange = jest.fn();
  const view = await render(
    <MemberSortButton value="paid" onValueChange={onValueChange} />,
  );
  const picker = view.getByTestId("member-sort-menu");
  expect(picker.props.selection).toBe("paid");
  for (const selection of ["share", "paid", "name"]) {
    await fireEvent(picker, "selectionChange", { nativeEvent: { selection } });
    expect(onValueChange).toHaveBeenLastCalledWith(selection);
  }
});
