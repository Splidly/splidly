import type { CurrencyCode, ExpenseContext } from "@splidly/shared";
import type { Href } from "expo-router";
import type { ActivityPreviewAction } from "../components/native-activity-list.types";

type Open = (destination: Href) => void;

export function groupPreviewActions(id: string, hasOpenBalances: boolean, open: Open): ActivityPreviewAction[] {
  return [
    {
      id: "add-expense", title: "Add expense", symbol: "plus",
      onPress: () => open({ pathname: "/expense/new", params: { type: "group", id } }),
    },
    ...(hasOpenBalances ? [{
      id: "settle-up", title: "Settle up", symbol: "arrow.left.arrow.right",
      onPress: () => open({ pathname: "/settlement/group", params: { id } }),
    }] : []),
    {
      id: "statistics", title: "Statistics", symbol: "chart.bar",
      onPress: () => open(`/groups/${id}/statistics` as Href),
    },
    {
      id: "settings", title: "Group settings", symbol: "gearshape",
      onPress: () => open(`/groups/${id}/settings` as Href),
    },
  ];
}

export function friendPreviewActions(
  id: string, friendId: string | undefined, canonicalCurrency: CurrencyCode, open: Open,
): ActivityPreviewAction[] {
  return [
    {
      id: "add-expense", title: "Add expense", symbol: "plus", disabled: !friendId,
      onPress: () => open({ pathname: "/expense/new", params: { type: "friend", id } }),
    },
    {
      id: "record-payment", title: "Record payment", symbol: "arrow.left.arrow.right", disabled: !friendId,
      onPress: () => open({ pathname: "/settlement/new", params: {
        type: "friend", id, friendshipId: id, friendId, canonicalCurrency,
      } }),
    },
    {
      id: "open", title: "Open details", symbol: "arrow.up.right",
      onPress: () => open(`/friends/${id}` as Href),
    },
  ];
}

export function expensePreviewActions(
  id: string, open: Open, remove: () => Promise<boolean>, deleting: boolean,
): ActivityPreviewAction[] {
  return [
    {
      id: "edit", title: "Edit expense", symbol: "pencil", disabled: deleting,
      onPress: () => open(`/expense/${id}/edit` as Href),
    },
    {
      id: "duplicate", title: "Duplicate expense", symbol: "doc.on.doc", disabled: deleting,
      onPress: () => open({ pathname: "/expense/new", params: { duplicateExpenseId: id } }),
    },
    {
      id: "delete", title: "Delete expense", symbol: "trash", destructive: true, disabled: deleting,
      onPress: remove,
    },
  ];
}

export function settlementPreviewActions(
  settlement: {
    id: string;
    from: { userId: string; isViewer: boolean };
    to: { userId: string; isViewer: boolean };
  },
  context: ExpenseContext,
  canonicalCurrency: CurrencyCode,
  open: Open,
  remove: () => Promise<boolean>,
  deleting: boolean,
): ActivityPreviewAction[] {
  return [
    {
      id: "open", title: "Open details", symbol: "arrow.up.right", disabled: deleting,
      onPress: () => open({ pathname: "/settlement/[id]", params: { id: settlement.id } }),
    },
    {
      id: "edit", title: "Edit payment", symbol: "pencil", disabled: deleting,
      onPress: () => open({ pathname: "/settlement/new", params: {
        type: context.type,
        id: context.type === "group" ? context.groupId : context.friendshipId,
        ...(context.type === "friend" ? {
          friendshipId: context.friendshipId,
          friendId: settlement.from.isViewer ? settlement.to.userId : settlement.from.userId,
        } : {}),
        canonicalCurrency,
        settlementId: settlement.id,
      } }),
    },
    {
      id: "delete", title: "Delete payment", symbol: "trash", destructive: true, disabled: deleting,
      onPress: remove,
    },
  ];
}
