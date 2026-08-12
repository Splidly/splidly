import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme";
import {
  GroupBalanceMemberRow,
  MemberRelationships,
  type GroupBalanceMember,
} from "./group-balances";

function RemoveMemberAction({
  member,
  disabled,
  swipeable,
  onRemove,
}: {
  member: GroupBalanceMember;
  disabled: boolean;
  swipeable: SwipeableMethods;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${member.displayName}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        swipeable.close();
        onRemove();
      }}
      style={({ pressed }) => ({
        width: 88,
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.negative,
        opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
      })}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
        Remove
      </Text>
    </Pressable>
  );
}

export function SwipeableGroupMember({
  member,
  viewerUserId,
  expanded,
  removalPending,
  onToggle,
  onRemove,
}: {
  member: GroupBalanceMember;
  viewerUserId: string;
  expanded: boolean;
  removalPending: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const row = (
    <GroupBalanceMemberRow
      member={member}
      expanded={expanded}
      onPress={onToggle}
    />
  );

  return (
    <View>
      {member.isViewer ? (
        row
      ) : (
        <ReanimatedSwipeable
          testID={`member-swipe-${member.userId}`}
          enabled={!removalPending}
          friction={1.4}
          rightThreshold={44}
          overshootRight={false}
          enableTrackpadTwoFingerGesture
          containerStyle={{ backgroundColor: theme.negative }}
          childrenContainerStyle={{ backgroundColor: theme.surface }}
          renderRightActions={(_, __, swipeable) => (
            <RemoveMemberAction
              member={member}
              disabled={removalPending}
              swipeable={swipeable}
              onRemove={onRemove}
            />
          )}
        >
          {row}
        </ReanimatedSwipeable>
      )}
      {expanded ? (
        <MemberRelationships member={member} viewerUserId={viewerUserId} />
      ) : null}
    </View>
  );
}
