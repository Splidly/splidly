import type { Money } from "@splidly/shared";
import { Text, View } from "react-native";
import { settlementPaymentSummary } from "../lib/settlement-activity";
import { useTheme } from "../theme";
import { Avatar } from "./ui";

type SettlementPerson = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isViewer: boolean;
};

export function SettlementActivityRow({
  settlement,
}: {
  settlement: {
    from: SettlementPerson;
    to: SettlementPerson;
    amount: Money;
  };
}) {
  const theme = useTheme();

  return (
    <View
      testID="settlement-activity-row"
      accessibilityLabel={`Payment. ${settlementPaymentSummary(settlement)}`}
      style={{
        minHeight: 78,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: theme.elevated,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 58, height: 44 }}
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

      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: theme.primary,
          }}
        >
          <Text
            style={{
              color: theme.primaryText,
              fontSize: 10,
              lineHeight: 13,
              fontWeight: "800",
              letterSpacing: 0.45,
              textTransform: "uppercase",
            }}
          >
            Payment
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: theme.muted, fontSize: 14, lineHeight: 18 }}
        >
          {settlementPaymentSummary(settlement)}
        </Text>
      </View>
    </View>
  );
}
