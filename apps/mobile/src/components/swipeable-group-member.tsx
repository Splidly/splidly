import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Image } from "expo-image";
import { PlatformColor, Pressable, Text, View } from "react-native";
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
        width: 82,
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        backgroundColor:
          process.env.EXPO_OS === "ios"
            ? PlatformColor("systemRed")
            : theme.negative,
        opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
      })}
    >
      {process.env.EXPO_OS === "ios" ? (
        <Image
          source="sf:person.badge.minus"
          contentFit="contain"
          tintColor="#FFFFFF"
          style={{ width: 21, height: 21 }}
        />
      ) : null}
      <Text
        selectable={false}
        style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}
      >
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
  canRemove,
  onToggle,
  onRemove,
}: {
  member: GroupBalanceMember;
  viewerUserId: string;
  expanded: boolean;
  removalPending: boolean;
  canRemove: boolean;
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
      {member.isViewer || !canRemove ? (
        row
      ) : (
        <ReanimatedSwipeable
          testID={`member-swipe-${member.userId}`}
          enabled={!removalPending}
          friction={1}
          rightThreshold={41}
          overshootRight
          overshootFriction={8}
          enableTrackpadTwoFingerGesture
          containerStyle={{
            backgroundColor:
              process.env.EXPO_OS === "ios"
                ? PlatformColor("systemRed")
                : theme.negative,
          }}
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
