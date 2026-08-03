import {
  notificationHref,
  parseExpenseNotificationData,
} from "./notification-data";

describe("expense notification data", () => {
  it("opens an existing expense for create and update events", () => {
    const data = parseExpenseNotificationData({
      eventType: "expense.updated",
      expenseId: "expense-id",
      expenseVersion: "2",
      groupId: "group-id",
    });
    expect(data).toBeDefined();
    expect(notificationHref(data!)).toBe("/expense/expense-id");
  });

  it("opens the group after a deletion", () => {
    const data = parseExpenseNotificationData({
      eventType: "expense.deleted",
      expenseId: "expense-id",
      expenseVersion: "3",
      groupId: "group-id",
    });
    expect(notificationHref(data!)).toBe("/groups/group-id");
  });

  it("rejects unrelated or incomplete push payloads", () => {
    expect(parseExpenseNotificationData({ eventType: "invite.created" })).toBe(
      undefined,
    );
    expect(
      parseExpenseNotificationData({
        eventType: "expense.created",
        expenseId: "expense-id",
      }),
    ).toBe(undefined);
  });

  it("routes a smart summary to its group", () => {
    const data = parseExpenseNotificationData({
      eventType: "expense.summary",
      groupId: "group-id",
    });

    expect(data).toEqual({
      eventType: "expense.summary",
      groupId: "group-id",
    });
    expect(notificationHref(data!)).toBe("/groups/group-id");
  });
});
