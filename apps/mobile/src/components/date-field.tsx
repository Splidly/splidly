import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { ListRow } from "./ui";
import { useTheme } from "../theme";

export function DateField({
  value,
  onValueChange,
}: {
  value: Date;
  onValueChange: (value: Date) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ListRow
        title="Date"
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
          accentColor={String(theme.primary)}
          testID="expense-date"
        />
      ) : null}
    </>
  );
}
