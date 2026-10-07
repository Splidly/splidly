import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { api } from "./trpc";

type ActivityExpense = { id: string; description: string; version: number };

export function useDeleteActivityExpense() {
  const utils = api.useUtils();
  const busy = useRef(false);
  const pendingResult = useRef<((deleted: boolean) => void) | undefined>(
    undefined,
  );
  function finish(deleted: boolean) {
    pendingResult.current?.(deleted);
    pendingResult.current = undefined;
  }
  useEffect(() => () => finish(false), []);
  const remove = api.expenses.remove.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.list.invalidate(),
        utils.groups.detail.invalidate(),
        utils.groups.balances.invalidate(),
        utils.groups.statistics.invalidate(),
        utils.friends.list.invalidate(),
        utils.friends.detail.invalidate(),
        utils.expenses.detail.invalidate(),
      ]);
      finish(true);
    },
    onError(error) {
      finish(false);
      Alert.alert("Could not delete expense", error.message);
    },
    onSettled() {
      busy.current = false;
      finish(false);
    },
  });

  function confirmDelete(expense: ActivityExpense): Promise<boolean> {
    if (busy.current) return Promise.resolve(false);
    busy.current = true;
    const result = new Promise<boolean>((resolve) => {
      pendingResult.current = resolve;
    });
    let submitted = false;
    let canceled = false;
    Alert.alert(
      "Delete expense?",
      `“${expense.description}” will be removed and its balances will be reversed.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            if (submitted || canceled) return;
            canceled = true;
            busy.current = false;
            finish(false);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (submitted || canceled) return;
            submitted = true;
            remove.mutate({
              expenseId: expense.id,
              expectedVersion: expense.version,
            });
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          if (!submitted && !canceled) {
            canceled = true;
            busy.current = false;
            finish(false);
          }
        },
      },
    );
    return result;
  }

  return { confirmDelete, isPending: remove.isPending };
}
