import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { ListRow } from "./ui";
import { useTheme } from "../theme";

export function DateField({
  value,
  onValueChange,
  label = "Date",
  minimumDate,
  maximumDate,
  testID = "expense-date",
}: {
  value: Date;
  onValueChange: (value: Date) => void;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ListRow
        title={label}
        value={value.toLocaleDateString(undefined, {
          dateStyle: "medium",
        })}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <DateTimePicker
          value={value}
          onValueChange={(_, selectedDate) => {
            onValueChange(selectedDate);
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
          mode="date"
          presentation="dialog"
          {...(minimumDate ? { minimumDate } : {})}
          {...(maximumDate ? { maximumDate } : {})}
          accentColor={String(theme.primary)}
          testID={testID}
        />
      ) : null}
    </>
  );
}
