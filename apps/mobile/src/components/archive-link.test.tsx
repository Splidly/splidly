import { fireEvent, render } from "@testing-library/react-native";
import { ArchiveLink } from "./archive-link.ios";

it.each([undefined, 0, 2, 120])("aligns the native disclosure with the label and count %s", async (count) => {
  const onPress = jest.fn();
  const view = await render(<ArchiveLink label="Settled Friends" count={count} icon="settled" onPress={onPress} />);
  const button = view.getByTestId("archive-link");
  const textRow = view.getByTestId("archive-link-content");
  expect(textRow.props.alignment).toBe("center");
  expect(button.queryAll((node) => node.props.alignment === "firstTextBaseline")).toHaveLength(0);
  expect(textRow.queryAll((node) => node.props.systemName === "chevron.right")).toHaveLength(1);
  expect(textRow.queryAll((node) => node.props.text === "Settled Friends")).toHaveLength(1);
  if (count !== undefined) {
    expect(textRow.queryAll((node) => node.props.text === String(count))).toHaveLength(1);
  }
  expect(button.props.modifiers).toContainEqual(expect.objectContaining({ $type: "textSelection", value: false }));
  await fireEvent(button, "buttonPress");
  expect(onPress).toHaveBeenCalledTimes(1);
});
