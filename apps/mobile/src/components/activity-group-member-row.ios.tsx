import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { accessibilityHidden, contentShape, font, foregroundStyle, frame, lineLimit, padding, shapes, textSelection } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../theme";
import type { ActivityMemberInviteProps } from "./activity-group-member-row.types";

export function ActivityMemberInvite({
  pending,
  onPress,
}: ActivityMemberInviteProps) {
  const theme = useTheme();
  return (
    <Button
      onPress={onPress}
      testID="activity-member-invite"
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
        <VStack alignment="leading" spacing={3}>
          <Text
            modifiers={[
              font({ textStyle: "body" }),
              foregroundStyle("#007AFF"),
              lineLimit(1),
            ]}
          >
            {pending ? "Creating invitation…" : "Invite people"}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, textStyle: "footnote" }),
              foregroundStyle(theme.muted),
              lineLimit(1),
            ]}
          >
            Share a reusable link valid for 7 days
          </Text>
        </VStack>
        <Spacer minLength={0} />
        <Image
          systemName="chevron.right"
          size={12}
          color={theme.muted}
          modifiers={[accessibilityHidden()]}
        />
      </HStack>
    </Button>
  );
}
