import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { ExpenseSaveControl } from "./expense-composer-ui";
import { SettlementSaveControl } from "./settlement-composer";
import { AllocationFloatingSummary } from "./allocation-floating-summary";

describe("floating controls in form sheets", () => {
  it("sizes save controls to the sheet instead of the device window", async () => {
    for (const Control of [ExpenseSaveControl, SettlementSaveControl]) {
      const view = await render(
        <Control label="Save" onPress={jest.fn()} disabled={false} />,
      );
      const [container] = view.container.queryAll((instance) => {
        const style = StyleSheet.flatten(instance.props.style);
        return style?.maxWidth === 768;
      });
      const style = StyleSheet.flatten(container?.props.style);
      expect(style.width).toBe("100%");
      expect(style.maxWidth).toBe(768);
      await view.unmount();
    }
  });

  it("keeps the allocation summary inside the sheet", async () => {
    const view = await render(
      <AllocationFloatingSummary title="Allocated" progress={0.5} complete={false} />,
    );
    const style = StyleSheet.flatten(
      view.getByTestId("allocation-floating-summary").props.style,
    );
    expect(style.width).toBe("100%");
    expect(style.maxWidth).toBe(768);
  });
});
