import { fireEvent, render } from "@testing-library/react-native";
import { SettlementActivityRow as IOSSettlementActivityRow } from "./settlement-activity-row.ios";

const { SettlementActivityRow } = jest.requireActual<typeof import("./settlement-activity-row")>("./settlement-activity-row.tsx");

it("keeps long payment names complete and the amount inline, without selectable text", async () => {
  const onPress = jest.fn();
  const view = await render(
    <SettlementActivityRow
      settlement={{
        from: {
          userId: "kevin",
          displayName: "Kevin Schiffmacher",
          isViewer: false,
        },
        to: { userId: "marc", displayName: "Marc Frech", isViewer: false },
        amount: { currency: "EUR", minor: "965" },
      }}
      onPress={onPress}
    />,
  );
  const names = view.getByText("Kevin Schiffmacher paid Marc Frech 9.65 €");
  expect(names.props.numberOfLines).toBeUndefined();
  expect(view.queryByText("9.65 €")).toBeNull();
  for (const text of [
    names,
    view.getByText("Payment"),
    view.getByText("→", { includeHiddenElements: true }),
  ]) {
    expect(text.props.selectable).toBe(false);
  }
  await fireEvent.press(
    view.getByLabelText("Payment. Kevin Schiffmacher paid Marc Frech 9.65 €"),
  );
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("lets iOS size long payment text natively without a nested React Native host", async () => {
  const onPress = jest.fn();
  const view = await render(
    <IOSSettlementActivityRow
      settlement={{
        from: { userId: "kevin", displayName: "Kevin Schiffmacher", isViewer: false },
        to: { userId: "marc", displayName: "Marc Frech", isViewer: false },
        amount: { currency: "EUR", minor: "965" },
      }}
      onPress={onPress}
    />,
  );
  const row = view.getByTestId("settlement-activity-row");
  expect(row.queryAll((node) => node.props.matchContents !== undefined || node.props.onPress !== undefined)).toHaveLength(0);
  const names = row.queryAll((node) => node.props.text === "Kevin Schiffmacher paid Marc Frech 9.65 €");
  expect(names).toHaveLength(1);
  expect(names[0]!.props.modifiers).toContainEqual(
    expect.objectContaining({ $type: "fixedSize", horizontal: false, vertical: true }),
  );
  expect(row.props.modifiers).toContainEqual(expect.objectContaining({ $type: "textSelection", value: false }));
  await fireEvent(row, "buttonPress");
  expect(onPress).toHaveBeenCalledTimes(1);
});
