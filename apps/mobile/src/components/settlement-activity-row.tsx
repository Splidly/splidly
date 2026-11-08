import { Pressable, Text, View } from "react-native";
import { settlementPaymentSummary } from "../lib/settlement-activity";
import { useTheme } from "../theme";
import { Avatar } from "./ui";
import type { SettlementActivityRowProps } from "./settlement-activity-row.types";

export function SettlementActivityRow({
  settlement,
  onPress,
}: SettlementActivityRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID="settlement-activity-row"
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Payment. ${settlementPaymentSummary(settlement)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: pressed && onPress ? theme.elevated : "transparent",
      })}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 58, height: 44, flexShrink: 0 }}
      >
        <View style={{ position: "absolute", left: 0, top: 6 }}>
          <Avatar
            name={settlement.from.displayName}
            colorKey={settlement.from.userId}
            imageUrl={settlement.from.avatarUrl}
            size={32}
          />
        </View>
        <View style={{ position: "absolute", right: 0, top: 6 }}>
          <Avatar
            name={settlement.to.displayName}
            colorKey={settlement.to.userId}
            imageUrl={settlement.to.avatarUrl}
            size={32}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: 19,
            top: 13,
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.primary,
          }}
        >
          <Text
            selectable={false}
            style={{
              color: theme.primaryText,
              fontSize: 12,
              lineHeight: 14,
              fontWeight: "800",
            }}
          >
            →
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, flexShrink: 1, gap: 2 }}>
        <Text
          selectable={false}
          style={{
            color: theme.primary,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "600",
          }}
        >
          Payment
        </Text>
        <Text
          selectable={false}
          style={{ color: theme.muted, fontSize: 14, lineHeight: 20, flexShrink: 1 }}
        >
          {settlementPaymentSummary(settlement)}
        </Text>
      </View>
    </Pressable>
  );
}
