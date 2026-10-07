import { Host, RNHostView } from "@expo/ui/jetpack-compose";
import { requireNativeView } from "expo";
import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { useTheme } from "../theme";
import type { ActivityListRow } from "./native-activity-list.types";

const ExpenseSwipeView = requireNativeView<{
  children: React.ReactNode;
  enabled: boolean;
  deleteLabel: string;
  backgroundColor: string;
  onDelete: () => void;
}>("SplidlySwipe", "ExpenseSwipeView");

export function NativeExpenseSwipe({
  children,
  row,
}: PropsWithChildren<{ row: ActivityListRow }>) {
  const theme = useTheme();
  if (!row.onDelete) return <>{children}</>;
  return (
    <Host matchContents={{ vertical: true }}>
      <ExpenseSwipeView
        enabled={!row.deletionDisabled}
        deleteLabel={row.deleteLabel ?? "Delete expense"}
        backgroundColor={theme.negative as string}
        onDelete={row.onDelete}
      >
        <RNHostView matchContents>
          <View style={{ backgroundColor: theme.surface }}>{children}</View>
        </RNHostView>
      </ExpenseSwipeView>
    </Host>
  );
}
