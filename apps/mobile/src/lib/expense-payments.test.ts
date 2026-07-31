import {
  equalPaymentAmounts,
  expensePaymentStatus,
} from "./expense-payments";

describe("expense payment allocations", () => {
  it("assigns the full amount to a single payer", () => {
    expect(expensePaymentStatus(["a"], {}, 7_000n, "EUR")).toEqual({
      valid: true,
      assignedMinor: 7_000n,
      payments: [{ userId: "a", amountMinor: "7000" }],
      message: "Fully assigned",
    });
  });

  it("requires multiple payer amounts to equal the total", () => {
    expect(
      expensePaymentStatus(
        ["a", "b"],
        { a: "50", b: "20" },
        7_000n,
        "EUR",
      ),
    ).toMatchObject({ valid: true, assignedMinor: 7_000n });
    expect(
      expensePaymentStatus(
        ["a", "b"],
        { a: "50", b: "10" },
        7_000n,
        "EUR",
      ),
    ).toMatchObject({ valid: false, assignedMinor: 6_000n });
  });

  it("can initialize multiple payers evenly", () => {
    expect(equalPaymentAmounts(["a", "b"], 7_001n, "EUR")).toEqual({
      a: "35.01",
      b: "35.00",
    });
  });
});
