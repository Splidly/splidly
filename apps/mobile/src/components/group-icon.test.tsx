import { useState, type ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { GroupIconKey } from "@splidly/shared";
import {
  GroupIconPicker,
  normalizeGroupIconKey,
} from "./group-icon";

jest.mock("@expo/ui/community/menu", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    MenuView: ({
      children,
      ...props
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => <View {...props}>{children}</View>,
  };
});

function ControlledPicker() {
  const [value, setValue] = useState<GroupIconKey>("default");
  return (
    <GroupIconPicker
      value={value}
      onValueChange={setValue}
      name="Lisbon"
      colorKey="group-1"
    />
  );
}

describe("GroupIconPicker", () => {
  it("falls back to the people icon for unknown stored values", () => {
    expect(normalizeGroupIconKey(undefined)).toBe("default");
    expect(normalizeGroupIconKey("person.3.fill")).toBe("default");
  });

  it("selects a semantic icon key from the native anchored menu", async () => {
    const view = await render(<ControlledPicker />);
    const menu = view.getByTestId("group-icon-picker");

    expect(
      menu.props.actions.find(
        (action: { id: string }) => action.id === "default",
      ).state,
    ).toBe("on");

    await fireEvent(menu, "pressAction", {
      nativeEvent: { event: "trip" },
    });

    expect(
      view
        .getByTestId("group-icon-picker")
        .props.actions.find(
          (action: { id: string }) => action.id === "trip",
        ).state,
    ).toBe("on");
  });
});
