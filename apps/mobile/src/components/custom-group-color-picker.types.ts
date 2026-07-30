import type { GroupColor } from "@splidly/shared";

export type CustomGroupColorPickerProps = {
  value: GroupColor;
  selected: boolean;
  onValueChange: (value: GroupColor) => void;
};
