import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  accessibilityHint,
  backgroundOverlay,
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
import { ActivityAvatar } from "./activity-avatar.ios";
import {
  memberBalanceStatusText,
  relationshipSentence,
} from "./group-balances";
import type {
  ActivityGroupMemberRowProps,
  ActivityMemberInviteProps,
} from "./activity-group-member-row.types";

export function ActivityGroupMemberRow({
  member,
  viewerUserId,
  expanded,
  onToggle,
}: ActivityGroupMemberRowProps) {
  const theme = useTheme();
  const owes = BigInt(member.owes.minor) > 0n;
  const lent = BigInt(member.lent.minor) > 0n;
  const name = member.isViewer
    ? `${member.displayName} (You)`
    : member.displayName;
  return (
    <VStack alignment="leading" spacing={0} modifiers={[textSelection(false)]}>
      <Button
        onPress={onToggle}
        testID={`activity-member-${member.userId}`}
        modifiers={[
          textSelection(false),
          accessibilityLabel(`${name}. ${memberBalanceStatusText(member)}`),
          accessibilityHint(
            expanded ? "Collapses balance details" : "Expands balance details",
          ),
        ]}
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
            name={member.displayName}
            colorKey={member.userId}
            imageUrl={member.avatarUrl}
          />
          <Text
            modifiers={[
              font({ textStyle: "body" }),
              foregroundStyle(theme.text),
              lineLimit(1),
            ]}
          >
            {name}
          </Text>
          <Spacer minLength={0} />
          <VStack
            alignment="trailing"
            spacing={2}
            modifiers={[layoutPriority(1)]}
          >
            {owes ? (
              <Text
                modifiers={[
                  font({
                    size: 14,
                    textStyle: "subheadline",
                    weight: "semibold",
                  }),
                  foregroundStyle(theme.negative),
                  monospacedDigit(),
                  lineLimit(1),
                ]}
              >
                Owes {formatMoney(member.owes.minor, member.owes.currency)}
              </Text>
            ) : null}
            {lent ? (
              <Text
                modifiers={[
                  font({
                    size: 14,
                    textStyle: "subheadline",
                    weight: "semibold",
                  }),
                  foregroundStyle(theme.positive),
                  monospacedDigit(),
                  lineLimit(1),
                ]}
              >
                Lent {formatMoney(member.lent.minor, member.lent.currency)}
              </Text>
            ) : null}
            {!owes && !lent ? (
              <Text
                modifiers={[
                  font({
                    size: 14,
                    textStyle: "subheadline",
                    weight: "semibold",
                  }),
                  foregroundStyle(theme.muted),
                  lineLimit(1),
                ]}
              >
                Settled up
              </Text>
            ) : null}
          </VStack>
          <Image
            systemName={expanded ? "chevron.up" : "chevron.down"}
            size={14}
            color={theme.subtle}
            modifiers={[
              frame({ width: 20, height: 44 }),
              accessibilityHidden(),
            ]}
          />
        </HStack>
      </Button>
      {expanded ? (
        <VStack
          alignment="leading"
          spacing={10}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({ horizontal: 16, vertical: 10 }),
            backgroundOverlay({ color: theme.elevated }),
          ]}
        >
          {member.relationships.length > 0 ? (
            member.relationships.map((relationship) => (
              <HStack
                key={`${relationship.kind}:${relationship.counterpartyId}`}
                spacing={10}
              >
                <ActivityAvatar
                  name={relationship.counterpartyDisplayName}
                  colorKey={relationship.counterpartyId}
                  imageUrl={relationship.counterpartyAvatarUrl}
                  size={34}
                />
                <Text
                  modifiers={[
                    font({ size: 15, textStyle: "subheadline" }),
                    foregroundStyle(theme.muted),
                    frame({ maxWidth: Infinity, alignment: "leading" }),
                  ]}
                >
                  {relationshipSentence(member, relationship, viewerUserId)}
                </Text>
              </HStack>
            ))
          ) : (
            <Text
              modifiers={[
                font({ size: 15, textStyle: "subheadline" }),
                foregroundStyle(theme.muted),
              ]}
            >
              No outstanding balances.
            </Text>
          )}
        </VStack>
      ) : null}
    </VStack>
  );
}

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
