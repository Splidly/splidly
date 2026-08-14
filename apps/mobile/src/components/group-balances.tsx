import type { CurrencyCode, Money } from "@splidly/shared";
import { useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { formatConvertedMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { Avatar, ListRow } from "./ui";
import { DropdownChevron } from "./dropdown-chevron";

export type GroupBalanceRelationship = {
  kind: "owes" | "lent";
  counterpartyId: string;
  counterpartyDisplayName: string;
  counterpartyAvatarUrl: string | null;
  amount: Money;
};

export type GroupBalanceMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isViewer: boolean;
  owes: Money;
  lent: Money;
  relationships: GroupBalanceRelationship[];
};

function formattedAmount(value: Money) {
  return formatConvertedMoney(
    BigInt(value.minor),
    value.currency as CurrencyCode,
  );
}

export function memberBalanceStatusText(member: GroupBalanceMember) {
  const statuses: string[] = [];
  if (BigInt(member.owes.minor) > 0n) {
    statuses.push(`Owes ${formattedAmount(member.owes)}`);
  }
  if (BigInt(member.lent.minor) > 0n) {
    statuses.push(`Lent ${formattedAmount(member.lent)}`);
  }
  return statuses.length > 0 ? statuses.join(" · ") : "Settled up";
}

export function relationshipSentence(
  member: GroupBalanceMember,
  relationship: GroupBalanceRelationship,
  viewerUserId: string,
) {
  const memberName = member.isViewer ? "you" : member.displayName;
  const counterpartyName =
    relationship.counterpartyId === viewerUserId
      ? "you"
      : relationship.counterpartyDisplayName;
  const debtorName =
    relationship.kind === "owes" ? memberName : counterpartyName;
  const creditorName =
    relationship.kind === "owes" ? counterpartyName : memberName;
  const debtorAtStart =
    debtorName === "you"
      ? "You"
      : debtorName.charAt(0).toUpperCase() + debtorName.slice(1);
  return `${debtorAtStart} ${debtorName === "you" ? "owe" : "owes"} ${formattedAmount(relationship.amount)} to ${creditorName}`;
}

export function GroupBalanceMemberRow({
  member,
  expanded,
  onPress,
}: {
  member: GroupBalanceMember;
  expanded: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchMoved = useRef(false);
  const owes = BigInt(member.owes.minor);
  const lent = BigInt(member.lent.minor);
  const title = member.isViewer
    ? `${member.displayName} (You)`
    : member.displayName;

  return (
    <View
      onTouchStart={(event: GestureResponderEvent) => {
        touchStart.current = {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        };
        touchMoved.current = false;
      }}
      onTouchMove={(event: GestureResponderEvent) => {
        if (!touchStart.current) return;
        if (
          Math.abs(event.nativeEvent.pageX - touchStart.current.x) > 8 ||
          Math.abs(event.nativeEvent.pageY - touchStart.current.y) > 8
        ) {
          touchMoved.current = true;
        }
      }}
    >
      <ListRow
        accessibilityLabel={`${title}. ${memberBalanceStatusText(member)}`}
        accessibilityHint={
          expanded ? "Collapses balance details" : "Expands balance details"
        }
        accessibilityState={{ expanded }}
        title={title}
        leading={
          <Avatar
            name={member.displayName}
            colorKey={member.userId}
            imageUrl={member.avatarUrl}
          />
        }
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              {owes > 0n ? (
                <Text
                  selectable={false}
                  style={{
                    color: theme.negative,
                    fontSize: 14,
                    lineHeight: 18,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Owes {formattedAmount(member.owes)}
                </Text>
              ) : null}
              {lent > 0n ? (
                <Text
                  selectable={false}
                  style={{
                    color: theme.positive,
                    fontSize: 14,
                    lineHeight: 18,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Lent {formattedAmount(member.lent)}
                </Text>
              ) : null}
              {owes === 0n && lent === 0n ? (
                <Text
                  selectable={false}
                  style={{
                    color: theme.muted,
                    fontSize: 14,
                    lineHeight: 18,
                    fontWeight: "600",
                  }}
                >
                  Settled up
                </Text>
              ) : null}
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 20,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DropdownChevron
                color={theme.subtle}
                direction={expanded ? "up" : "down"}
                size={14}
                testID={`balance-disclosure-${member.userId}-${expanded ? "expanded" : "collapsed"}`}
              />
            </View>
          </View>
        }
        onPress={() => {
          if (!touchMoved.current) onPress();
        }}
      />
    </View>
  );
}

export function MemberRelationships({
  member,
  viewerUserId,
}: {
  member: GroupBalanceMember;
  viewerUserId: string;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(100)}
      style={{
        backgroundColor: theme.elevated,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      {member.relationships.length > 0 ? (
        <View>
          {member.relationships.map((relationship, index) => {
            const sentence = relationshipSentence(
              member,
              relationship,
              viewerUserId,
            );
            const debtorName =
              relationship.kind === "owes"
                ? member.isViewer
                  ? "You"
                  : member.displayName
                : relationship.counterpartyId === viewerUserId
                  ? "You"
                  : relationship.counterpartyDisplayName;
            const creditorName =
              relationship.kind === "owes"
                ? relationship.counterpartyId === viewerUserId
                  ? "you"
                  : relationship.counterpartyDisplayName
                : member.isViewer
                  ? "you"
                  : member.displayName;
            return (
              <View
                key={`${relationship.kind}:${relationship.counterpartyId}`}
                accessible
                accessibilityLabel={sentence}
                style={{
                  minHeight: 54,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ width: 34, alignSelf: "stretch" }}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 16,
                      top: index === 0 ? 27 : 0,
                      bottom:
                        index === member.relationships.length - 1 ? 27 : 0,
                      width: StyleSheet.hairlineWidth,
                      backgroundColor: theme.border,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 16,
                      top: 27,
                      width: 12,
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.border,
                    }}
                  />
                </View>
                <Avatar
                  name={relationship.counterpartyDisplayName}
                  colorKey={relationship.counterpartyId}
                  imageUrl={relationship.counterpartyAvatarUrl}
                  size={34}
                />
                <Text
                  selectable
                  style={{
                    flex: 1,
                    color: theme.muted,
                    fontSize: 15,
                    lineHeight: 20,
                    paddingLeft: 10,
                  }}
                >
                  {debtorName} {debtorName === "You" ? "owe" : "owes"}{" "}
                  <Text
                    style={{
                      color:
                        relationship.kind === "owes"
                          ? theme.negative
                          : theme.positive,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formattedAmount(relationship.amount)}
                  </Text>{" "}
                  to {creditorName}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text
          selectable
          style={{
            color: theme.muted,
            fontSize: 15,
            lineHeight: 20,
            paddingLeft: 34,
          }}
        >
          No outstanding balances.
        </Text>
      )}
    </Animated.View>
  );
}
