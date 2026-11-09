import type { CurrencyCode, Money } from "@splidly/shared";
import { useRef } from "react";
import {
  View,
  type GestureResponderEvent,
} from "react-native";
import { formatConvertedMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { ExpenseBalanceStatus } from "./expense-list-involvement";
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

export function memberBalanceBadges(member: GroupBalanceMember, theme: ReturnType<typeof useTheme>) {
  const balances = [];
  if (BigInt(member.owes.minor) > 0n) balances.push({
    label: member.isViewer ? "You owe" : "Owes", amount: member.owes, color: theme.negative,
  });
  if (BigInt(member.lent.minor) > 0n) balances.push({
    label: member.isViewer ? "You lent" : "Lent", amount: member.lent, color: theme.positive,
  });
  return balances.length ? balances : [{ label: "Settled", amount: null, color: theme.muted }];
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
  const balances = memberBalanceBadges(member, theme);
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
        accessibilityHint={expanded ? "Collapses balance details" : "Expands balance details"}
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
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              {balances.map(balance => <ExpenseBalanceStatus key={balance.label} {...balance} />)}
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
              <View pointerEvents="none"><DropdownChevron color={theme.subtle} direction={expanded ? "up" : "down"} size={14} /></View>
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
