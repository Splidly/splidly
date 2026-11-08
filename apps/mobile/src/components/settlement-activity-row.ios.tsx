import { Button, HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { settlementPaymentSummary } from "../lib/settlement-activity";
import { useTheme } from "../theme";
import { ActivityAvatar } from "./activity-avatar.ios";
import type { SettlementActivityRowProps } from "./settlement-activity-row.types";

// Let SwiftUI size the complete row inside UIHostingConfiguration. A nested
// Yoga host can retain a different height and clip the names and avatars.
export function SettlementActivityRow({
  settlement,
  onPress,
}: SettlementActivityRowProps) {
  const theme = useTheme();
  return (
    <Button
      testID="settlement-activity-row"
      {...(onPress ? { onPress } : {})}
      modifiers={[
        textSelection(false),
        accessibilityLabel(`Payment. ${settlementPaymentSummary(settlement)}`),
      ]}
    >
      <HStack
        spacing={12}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 44, alignment: "leading" }),
          padding({ horizontal: 16, vertical: 8 }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <HStack spacing={4} modifiers={[accessibilityHidden(), fixedSize()]}>
          <ActivityAvatar
            name={settlement.from.displayName}
            colorKey={settlement.from.userId}
            imageUrl={settlement.from.avatarUrl}
            size={28}
          />
          <Image systemName="arrow.right" size={11} color={theme.primary} />
          <ActivityAvatar
            name={settlement.to.displayName}
            colorKey={settlement.to.userId}
            imageUrl={settlement.to.avatarUrl}
            size={28}
          />
        </HStack>
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <Text
            modifiers={[
              font({ size: 13, weight: "semibold" }),
              foregroundStyle(theme.primary),
            ]}
          >
            Payment
          </Text>
          <Text
            modifiers={[
              font({ size: 14 }),
              foregroundStyle(theme.muted),
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {settlementPaymentSummary(settlement)}
          </Text>
        </VStack>
      </HStack>
    </Button>
  );
}
