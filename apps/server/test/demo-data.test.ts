import { describe, expect, it } from "vitest";
import { demoWorkspaceFixture } from "../src/demo-data";

describe("demo workspace fixture", () => {
  it("contains balanced expenses and useful member balance states", () => {
    const demoUserId = "demo-user";
    const fixture = demoWorkspaceFixture(demoUserId);
    const totals = new Map<string, bigint>();

    expect(fixture.members.map((member) => member.name)).toEqual([
      "Alex Morgan",
      "Sam Rivera",
      "Bea Chen",
      "Chris Taylor",
    ]);
    expect(fixture.expenses).toHaveLength(15);

    for (const expense of fixture.expenses) {
      expect(
        expense.shares.reduce((sum, share) => sum + share.amountMinor, 0n),
      ).toBe(expense.amountMinor);
      for (const transfer of expense.transfers) {
        totals.set(
          transfer.debtorId,
          (totals.get(transfer.debtorId) ?? 0n) - transfer.amountMinor,
        );
        totals.set(
          transfer.creditorId,
          (totals.get(transfer.creditorId) ?? 0n) + transfer.amountMinor,
        );
      }
    }

    expect([...totals.values()].reduce((sum, amount) => sum + amount, 0n)).toBe(
      0n,
    );
    expect(totals.get(demoUserId)).toBe(-1_000n);
    expect(totals.get("demo-member-alex")).toBe(11_000n);
    expect(totals.get("demo-member-sam")).toBe(-3_000n);
    expect(totals.get("demo-member-bea")).toBe(-7_000n);
    expect(totals.get("demo-member-chris")).toBe(0n);

    expect(
      fixture.expenses.filter((expense) => expense.daysAgo <= 30),
    ).toHaveLength(8);
    expect(Math.max(...fixture.expenses.map((expense) => expense.daysAgo))).toBe(
      330,
    );
    expect(new Set(fixture.expenses.map((expense) => expense.iconKey)).size).toBe(
      8,
    );
    expect(new Set(fixture.expenses.map((expense) => expense.id)).size).toBe(
      fixture.expenses.length,
    );
    const transferIds = fixture.expenses.flatMap((expense) =>
      expense.transfers.map((transfer) => transfer.id),
    );
    expect(new Set(transferIds).size).toBe(transferIds.length);
    for (const memberId of [
      demoUserId,
      ...fixture.members.map((member) => member.id),
    ]) {
      expect(
        fixture.expenses.some((expense) => expense.payerId === memberId),
      ).toBe(true);
      expect(
        fixture.expenses.some((expense) =>
          expense.shares.some((share) => share.userId === memberId),
        ),
      ).toBe(true);
    }

    const demoTransfers = fixture.expenses.flatMap((expense) =>
      expense.transfers.filter(
        (transfer) =>
          transfer.debtorId === demoUserId ||
          transfer.creditorId === demoUserId,
      ),
    );
    expect(
      demoTransfers.some((transfer) => transfer.debtorId === demoUserId),
    ).toBe(true);
    expect(
      demoTransfers.some((transfer) => transfer.creditorId === demoUserId),
    ).toBe(true);
  });
});
