import { fireEvent, render } from "@testing-library/react-native";
import { GroupBalanceSummary } from "./group-summary-header";

const lines = ["Alex", "Bea", "Chris", "Dana"].map((name, index) => ({
  key: name,
  label: `${name} owes you`,
  text: `${name} owes you ${index + 1}.00 €`,
  amount: `${index + 1}.00 €`,
  tone: "positive" as const,
}));

describe("GroupBalanceSummary", () => {
  it("collapses more than three balances behind an outstanding total", async () => {
    const view = await render(
      <GroupBalanceSummary
        lines={lines}
        currency="EUR"
        totalMinor={1_000n}
      />,
    );

    expect(view.getByLabelText("Outstanding 10.00 €")).toBeTruthy();
    expect(view.queryByText(/Alex owes you/)).toBeNull();

    await fireEvent.press(view.getByLabelText("Outstanding 10.00 €"));
    expect(view.getByLabelText("Alex owes you 1.00 €")).toBeTruthy();
    expect(
      view.getByLabelText("Outstanding 10.00 €").props.accessibilityState,
    ).toEqual({ expanded: true });
  });
});
