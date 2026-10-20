import { Host } from "@expo/ui";
import { Menu, Picker, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  pickerStyle,
  tag,
  textSelection,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../theme";
import type { MemberSort } from "./member-sort-button.types";

export function MemberSortButton({
  value,
  onValueChange,
}: {
  value: MemberSort;
  onValueChange: (value: MemberSort) => void;
}) {
  const theme = useTheme();
  return (
    <Host matchContents ignoreSafeArea="all">
      <Menu
        testID="member-sort-button"
        label="Sort members"
        systemImage="arrow.up.arrow.down"
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          controlSize("regular"),
          labelStyle("iconOnly"),
          tint(theme.primary),
          accessibilityLabel(`Sort members, currently by ${value}`),
        ]}
      >
        <Picker
          testID="member-sort-menu"
          label="Sort members"
          selection={value}
          onSelectionChange={onValueChange}
          modifiers={[pickerStyle("inline")]}
        >
          <Text modifiers={[tag("share"), textSelection(false)]}>Share</Text>
          <Text modifiers={[tag("paid"), textSelection(false)]}>Paid</Text>
          <Text modifiers={[tag("name"), textSelection(false)]}>Name</Text>
        </Picker>
      </Menu>
    </Host>
  );
}
