import { Host, RNHostView } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView } from "expo";
import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { useFocusEffect } from "expo-router";
import { BackHandler, View } from "react-native";
import { useTheme } from "../theme";
import type { ActivityListRow } from "./native-activity-list.types";

const ExpenseSwipeView = requireNativeView<{
  children: React.ReactNode;
  enabled: boolean;
  deleteLabel: string;
  actionTitle: string;
  actionIcon: string;
  closeRequest: number;
  onRevealChange: (event: { nativeEvent: { open: boolean } }) => void;
  backgroundColor: string;
  onDelete: () => void;
}>("SplidlySwipe", "ExpenseSwipeView");

export function NativeExpenseSwipe({
  children,
  row,
}: PropsWithChildren<{ row: ActivityListRow }>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [closeRequest, setCloseRequest] = useState(0);
  useFocusEffect(useCallback(() => () => {
    setOpen(false);
    setCloseRequest((request) => request + 1);
  }, []));
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setCloseRequest((request) => request + 1);
      return true;
    });
    return () => subscription.remove();
  }, [open]);
  if (!row.onDelete) return <>{children}</>;
  return (
    <Host matchContents={{ vertical: true }}>
      <ExpenseSwipeView
        enabled={!row.deletionDisabled}
        deleteLabel={row.deleteLabel ?? row.actionTitle ?? "Delete expense"}
        actionTitle={row.actionTitle ?? "Delete"}
        actionIcon={row.actionIcon ?? "trash"}
        closeRequest={closeRequest}
        onRevealChange={(event) => setOpen(event.nativeEvent.open)}
        backgroundColor={row.actionColor ?? theme.negative as string}
        onDelete={row.onDelete}
      >
        <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}>
          <View style={{ backgroundColor: row.backgroundColor ?? theme.surface }}>{children}</View>
        </RNHostView>
      </ExpenseSwipeView>
    </Host>
  );
}
