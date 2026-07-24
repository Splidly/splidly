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
}: {
  value: Date;
  onValueChange: (value: Date) => void;
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
      <Text style={{ color: theme.text, fontSize: 17 }}>Date</Text>
      <Host
        matchContents
        ignoreSafeArea="all"
        seedColor={theme.primary}
      >
        <DatePicker
          selection={value}
          displayedComponents={["date"]}
          onDateChange={onValueChange}
          modifiers={[
            datePickerStyle("compact"),
            tint(theme.primary),
          ]}
          testID="expense-date"
        />
      </Host>
    </View>
  );
}
