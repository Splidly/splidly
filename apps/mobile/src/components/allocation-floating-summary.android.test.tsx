import { render } from "@testing-library/react-native";
import { AllocationFloatingSummary } from "./allocation-floating-summary.android";

describe("AllocationFloatingSummary on Android", () => {
  it("fits its sheet container instead of the full device window", async () => {
    const view = await render(
      <AllocationFloatingSummary
        title="€40.00 of €100.00"
        progress={0.4}
        complete={false}
      />,
    );

    expect(view.getByTestId("allocation-floating-summary").props.style.width)
      .toBe("100%");
  });
});
