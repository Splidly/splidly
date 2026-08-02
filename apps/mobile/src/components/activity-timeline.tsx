import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import type { ActivityDateGroup } from "../lib/activity-dates";
import { useTheme } from "../theme";
import { RowDivider } from "./ui";

export function ActivityTimeline<T>({
  groups,
  getItemKey,
  renderItem,
}: {
  groups: readonly ActivityDateGroup<T>[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: 14 }}>
      {groups.map((group) => (
        <View
          key={group.key}
          testID={`activity-date-${group.key}`}
          style={{ gap: 8 }}
        >
          <Text
            testID={`activity-date-label-${group.key}`}
            style={{
              color: theme.muted,
              paddingHorizontal: 16,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {group.label}
          </Text>
          <View
            style={{
              overflow: "hidden",
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: theme.surface,
            }}
          >
            {group.items.map((item, index) => (
              <Fragment key={getItemKey(item)}>
                {index > 0 ? <RowDivider inset={16} /> : null}
                {renderItem(item)}
              </Fragment>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
