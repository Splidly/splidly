import { describe, expect, it } from "vitest";
import {
  buildExpenseNotificationPayload,
  expenseNotificationRecipientIds,
} from "../src/domain/expense-notifications";

describe("expense notification recipients", () => {
  it("notifies every old or new participant except the actor once", () => {
    expect(
      expenseNotificationRecipientIds({
        actorId: "actor",
        previousParticipantIds: ["removed", "actor"],
        participantIds: ["actor", "current", "current"],
      }),
    ).toEqual(["removed", "current"]);
  });
});

describe("expense notification payloads", () => {
  it("uses a group fallback route payload for deleted expenses", () => {
    expect(
      buildExpenseNotificationPayload({
        action: "delete",
        actorName: "Ada",
        description: "Dinner",
        expenseId: "expense-id",
        expenseVersion: 3,
        groupId: "group-id",
        groupName: "Lisbon",
      }),
    ).toEqual({
      eventType: "expense.deleted",
      expenseId: "expense-id",
      expenseVersion: 3,
      groupId: "group-id",
      title: "Expense deleted",
      body: "Ada deleted “Dinner” in Lisbon",
    });
  });
});
