import { DatePicker, Host } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Text, View } from "react-native";
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

  return (
    <View
      style={{
        minHeight: 58,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text selectable={false} style={{ color: theme.text, fontSize: 17 }}>
        {label}
      </Text>
      <Host
        matchContents
        ignoreSafeArea="all"
        seedColor={theme.primary}
      >
        <DatePicker
          selection={value}
          {...(minimumDate || maximumDate
            ? {
                range: {
                  ...(minimumDate ? { start: minimumDate } : {}),
                  ...(maximumDate ? { end: maximumDate } : {}),
                },
              }
            : {})}
          displayedComponents={["date"]}
          onDateChange={onValueChange}
          modifiers={[
            datePickerStyle("compact"),
            tint(theme.primary),
          ]}
          testID={testID}
        />
      </Host>
    </View>
  );
}
