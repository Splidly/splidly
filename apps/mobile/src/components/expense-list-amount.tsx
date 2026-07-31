import { Text, View } from "react-native";
import { useTheme } from "../theme";

export function ExpenseListAmount({
  amount,
  originalAmount,
}: {
  amount: string;
  originalAmount?: string | undefined;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "flex-end", gap: 1 }}>
      <Text
        numberOfLines={1}
        style={{
          color: theme.text,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {amount}
      </Text>
      {originalAmount ? (
        <Text
          numberOfLines={1}
          style={{
            color: theme.muted,
            fontSize: 12,
            lineHeight: 16,
            fontVariant: ["tabular-nums"],
          }}
        >
          {originalAmount}
        </Text>
      ) : null}
    </View>
  );
}
