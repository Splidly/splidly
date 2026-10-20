import { Text, View } from "react-native";
import { useTheme } from "../theme";
import { Avatar, BalanceText, ListRow } from "./ui";
import type { ActivityFriendRowProps } from "./activity-friend-row.types";

export function ActivityFriendRow(props: ActivityFriendRowProps) {
  const theme = useTheme();
  return (
    <ListRow
      title={props.name}
      subtitle={props.subtitle}
      subtitleNumberOfLines={1}
      onPress={props.onPress}
      leading={
        <Avatar
          name={props.name}
          colorKey={props.colorKey}
          imageUrl={props.avatarUrl}
        />
      }
      trailing={
        props.balance ? (
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <BalanceText
              value={props.balance}
              prefix={BigInt(props.balance.minor) < 0n ? "You owe " : ""}
            />
            {props.additionalBalances > 0 ? (
              <Text
                selectable={false}
                style={{ color: theme.muted, fontSize: 12 }}
              >
                +{props.additionalBalances} more
              </Text>
            ) : null}
          </View>
        ) : (
          <Text
            selectable={false}
            style={{ color: theme.positive, fontWeight: "600" }}
          >
            Settled
          </Text>
        )
      }
    />
  );
}
