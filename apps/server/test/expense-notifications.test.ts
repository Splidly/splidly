import { describe, expect, it } from "vitest";
import {
  buildExpenseNotificationPayload,
  buildExpenseSummaryNotificationPayload,
  expenseNotificationInvolvement,
  isExpenseRecipientInvolved,
} from "../src/domain/expense-notifications";

describe("expense notification involvement", () => {
  it("describes what the recipient owes", () => {
    expect(
      expenseNotificationInvolvement({
        action: "create",
        currency: "EUR",
        shareMinor: 1_800n,
      }),
    ).toBe("You owe 18.00 EUR");
  });

  it("describes money owed to the recipient", () => {
    expect(
      expenseNotificationInvolvement({
        action: "update",
        currency: "USD",
        paymentMinor: 5_000n,
        shareMinor: 1_800n,
      }),
    ).toBe("You are owed 32.00 USD");
  });

  it("distinguishes a settled share from no involvement", () => {
    expect(
      expenseNotificationInvolvement({
        action: "create",
        currency: "EUR",
        paymentMinor: 1_800n,
        shareMinor: 1_800n,
      }),
    ).toBe("You paid your 18.00 EUR share");
    expect(
      expenseNotificationInvolvement({
        action: "create",
        currency: "EUR",
      }),
    ).toBe("You're not involved");
  });

  it("uses past tense for a deleted expense", () => {
    expect(
      expenseNotificationInvolvement({
        action: "delete",
        currency: "EUR",
        shareMinor: 1_800n,
      }),
    ).toBe("You owed 18.00 EUR");
    expect(
      expenseNotificationInvolvement({
        action: "delete",
        currency: "EUR",
      }),
    ).toBe("You weren't involved");
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
        recipientPaymentMinor: 7_200n,
        recipientShareMinor: 1_800n,
        sourceAmountMinor: 7_200n,
        sourceCurrency: "EUR",
      }),
    ).toEqual({
      eventType: "expense.deleted",
      expenseId: "expense-id",
      expenseVersion: 3,
      groupId: "group-id",
      title: "Splidly group activity",
      body: "Open Splidly to review recent activity.",
    });
  });

  it("builds a group-level summary for a notification burst", () => {
    const first = buildExpenseNotificationPayload({
      action: "create",
      actorName: "Ada",
      description: "Dinner",
      expenseId: "expense-1",
      expenseVersion: 1,
      groupId: "group-id",
      groupName: "Lisbon",
      sourceAmountMinor: 7_200n,
      sourceCurrency: "EUR",
    });

    expect(buildExpenseSummaryNotificationPayload([first, first])).toBe(
      undefined,
    );

    expect(
      buildExpenseSummaryNotificationPayload([first, first, first]),
    ).toEqual({
      eventType: "expense.summary",
      groupId: "group-id",
      eventCount: 3,
      title: "Splidly group activity",
      body: "Open Splidly to review recent activity.",
    });
  });
});

describe("expense notification recipients", () => {
  it("counts a payment or split as involvement, including zero-valued rows", () => {
    expect(isExpenseRecipientInvolved({})).toBe(false);
    expect(isExpenseRecipientInvolved({ paymentMinor: 0n })).toBe(true);
    expect(isExpenseRecipientInvolved({ shareMinor: 0n })).toBe(true);
  });
});
