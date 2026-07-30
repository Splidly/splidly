import { groupColorSchema } from "@splidly/shared";
import { CustomColorSwatch } from "./custom-color-swatch";
import type { CustomGroupColorPickerProps } from "./custom-group-color-picker.types";

export function CustomGroupColorPicker({
  selected,
  onValueChange,
}: CustomGroupColorPickerProps) {
  return (
    <CustomColorSwatch
      selected={selected}
      onPress={() => {
        const prompt = (
          globalThis as typeof globalThis & {
            prompt?: (message?: string, defaultValue?: string) => string | null;
          }
        ).prompt;
        const nextValue = prompt?.(
          "Custom group color",
          "#4745B8",
        );
        const parsed = groupColorSchema.safeParse(nextValue);
        if (parsed.success) onValueChange(parsed.data);
      }}
    />
  );
}
