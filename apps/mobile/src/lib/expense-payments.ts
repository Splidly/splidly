import {
  allocateByWeights,
  formatMinor,
  parseDecimalToMinor,
  type CurrencyCode,
  type PaymentInput,
} from "@splidly/shared";

export function equalPaymentAmounts(
  payerIds: readonly string[],
  totalMinor: bigint,
  currency: CurrencyCode,
) {
  if (payerIds.length === 0) return {};
  const amounts = allocateByWeights(
    totalMinor,
    payerIds.map(() => 1n),
  );
  return Object.fromEntries(
    payerIds.map((userId, index) => [
      userId,
      formatMinor(amounts[index] ?? 0n, currency),
    ]),
  );
}

export function expensePaymentStatus(
  payerIds: readonly string[],
  amounts: Readonly<Record<string, string>>,
  totalMinor: bigint,
  currency: CurrencyCode,
): {
  valid: boolean;
  assignedMinor: bigint;
  payments?: PaymentInput;
  message: string;
} {
  if (payerIds.length === 0) {
    return {
      valid: false,
      assignedMinor: 0n,
      message: "Select at least one payer",
    };
  }
  if (payerIds.length === 1) {
    return {
      valid: true,
      assignedMinor: totalMinor,
      payments: [{ userId: payerIds[0]!, amountMinor: totalMinor.toString() }],
      message: "Fully assigned",
    };
  }

  try {
    const payments = payerIds.map((userId) => ({
      userId,
      amountMinor: parseDecimalToMinor(
        amounts[userId] ?? "0",
        currency,
      ).toString(),
    }));
    const assignedMinor = payments.reduce(
      (sum, payment) => sum + BigInt(payment.amountMinor),
      0n,
    );
    if (payments.some((payment) => BigInt(payment.amountMinor) <= 0n)) {
      return {
        valid: false,
        assignedMinor,
        message: "Each selected payer needs a positive amount",
      };
    }
    if (assignedMinor !== totalMinor) {
      return {
        valid: false,
        assignedMinor,
        message: "Payer amounts must equal the expense total",
      };
    }
    return {
      valid: true,
      assignedMinor,
      payments,
      message: "Fully assigned",
    };
  } catch (cause) {
    return {
      valid: false,
      assignedMinor: 0n,
      message:
        cause instanceof Error ? cause.message : "Check the payer amounts",
    };
  }
}
