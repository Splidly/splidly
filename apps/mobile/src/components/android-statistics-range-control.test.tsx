import { fireEvent, render } from "@testing-library/react-native";
import { AndroidStatisticsRangeControl } from "./android-statistics-range-control";

it("exposes the selected period and lets each other period be selected", async () => {
  const onSelect = jest.fn();
  const labels = ["All time", "30 days", "1 year", "Custom"];
  const view = await render(<AndroidStatisticsRangeControl labels={labels} selectedIndex={0} onSelect={onSelect} />);
  expect(view.getByRole("tab", { name: "All time" }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(view.getByRole("tab", { name: "All time" }));
  expect(onSelect).not.toHaveBeenCalled();
  for (const [index, label] of labels.entries()) {
    if (index === 0) continue;
    await fireEvent.press(view.getByRole("tab", { name: label }));
    expect(onSelect).toHaveBeenLastCalledWith(index);
  }
  await view.rerender(<AndroidStatisticsRangeControl labels={labels} selectedIndex={3} onSelect={onSelect} />);
  expect(view.getByRole("tab", { name: "Custom" }).props.accessibilityState.selected).toBe(true);
  expect(view.getByRole("tab", { name: "All time" }).props.accessibilityState.selected).toBe(false);
  for (const label of labels) expect(view.getByText(label).props.selectable).toBe(false);
});
