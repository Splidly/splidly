import type { Href } from "expo-router";

export interface ExpenseNotificationData {
  eventType: "expense.created" | "expense.updated" | "expense.deleted";
  expenseId: string;
  expenseVersion: string;
  groupId: string;
}

export function parseExpenseNotificationData(
  value: unknown,
): ExpenseNotificationData | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (
    data.eventType !== "expense.created" &&
    data.eventType !== "expense.updated" &&
    data.eventType !== "expense.deleted"
  ) {
    return undefined;
  }
  if (
    typeof data.expenseId !== "string" ||
    typeof data.expenseVersion !== "string" ||
    typeof data.groupId !== "string"
  ) {
    return undefined;
  }
  return {
    eventType: data.eventType,
    expenseId: data.expenseId,
    expenseVersion: data.expenseVersion,
    groupId: data.groupId,
  };
}

export function notificationHref(data: ExpenseNotificationData): Href {
  return data.eventType === "expense.deleted"
    ? (`/groups/${data.groupId}` as Href)
    : (`/expense/${data.expenseId}` as Href);
}
