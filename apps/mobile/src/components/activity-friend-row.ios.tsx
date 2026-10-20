import { ActivityAvatar } from "./activity-avatar.ios";
import { Button, HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  contentShape,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import type { ActivityFriendRowProps } from "./activity-friend-row.types";

// Like ActivityExpenseRow, the complete tappable label stays in SwiftUI.
// UIKit owns tap cancellation during its list's native swipe gesture.
export function ActivityFriendRow(props: ActivityFriendRowProps) {
  const theme = useTheme();
  const minor = BigInt(props.balance?.minor ?? "0");
  const amount = props.balance
    ? `${minor < 0n ? "You owe " : ""}${formatMoney(minor < 0n ? -minor : minor, props.balance.currency)}`
    : "Settled";
  return (
    <Button
      onPress={props.onPress}
      testID={`activity-friend-${props.colorKey}`}
      modifiers={[textSelection(false)]}
    >
      <HStack
        spacing={12}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 44, alignment: "leading" }),
          padding({ horizontal: 16, vertical: 12 }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <ActivityAvatar
          name={props.name}
          colorKey={props.colorKey}
          imageUrl={props.avatarUrl}
        />
        <VStack alignment="leading" spacing={3}>
          <Text
            modifiers={[
              font({ textStyle: "body" }),
              foregroundStyle(theme.text),
              lineLimit(1),
            ]}
          >
            {props.name}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, textStyle: "footnote" }),
              foregroundStyle(theme.muted),
              lineLimit(1),
            ]}
          >
            {props.subtitle}
          </Text>
        </VStack>
        <Spacer minLength={0} />
        <VStack
          alignment="trailing"
          spacing={2}
          modifiers={[layoutPriority(1)]}
        >
          <Text
            modifiers={[
              font({ size: 15, textStyle: "subheadline", weight: "semibold" }),
              foregroundStyle(minor < 0n ? theme.negative : theme.positive),
              monospacedDigit(),
              lineLimit(1),
            ]}
          >
            {amount}
          </Text>
          {props.additionalBalances > 0 ? (
            <Text
              modifiers={[
                font({ size: 12, textStyle: "caption" }),
                foregroundStyle(theme.muted),
                lineLimit(1),
              ]}
            >
              +{props.additionalBalances} more
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </Button>
  );
}
