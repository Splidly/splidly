import { money, type CurrencyCode } from "@splidly/shared";

type ActivityPayment = {
  userId: string;
  displayName: string;
  sourceAmountMinor: bigint;
};

export function expenseActivitySummary(input: {
  sourceCurrency: CurrencyCode;
  sourceAmountMinor: bigint;
  legacyPayerId: string;
  legacyPayerDisplayName?: string | undefined;
  payments: ActivityPayment[];
  viewerUserId: string;
  viewerShareMinor?: bigint | undefined;
}) {
  const payments = (
    input.payments.length > 0
      ? input.payments
      : [
          {
            userId: input.legacyPayerId,
            displayName: input.legacyPayerDisplayName ?? "Deleted user",
            sourceAmountMinor: input.sourceAmountMinor,
          },
        ]
  ).toSorted((a, b) => {
    if (a.userId === input.legacyPayerId) return -1;
    if (b.userId === input.legacyPayerId) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
  const viewerPaidMinor = payments.reduce(
    (sum, payment) =>
      payment.userId === input.viewerUserId
        ? sum + payment.sourceAmountMinor
        : sum,
    0n,
  );
  const viewerShareMinor = input.viewerShareMinor ?? 0n;
  const viewerNetMinor = viewerPaidMinor - viewerShareMinor;
  const viewerInvolved =
    payments.some((payment) => payment.userId === input.viewerUserId) ||
    input.viewerShareMinor !== undefined;
  const kind =
    viewerNetMinor > 0n
      ? ("lent" as const)
      : viewerNetMinor < 0n
        ? ("borrowed" as const)
        : viewerInvolved
          ? ("settled" as const)
          : ("none" as const);

  return {
    payers: payments.map((payment) => ({
      userId: payment.userId,
      displayName: payment.displayName,
      isViewer: payment.userId === input.viewerUserId,
    })),
    paymentTotal: money(input.sourceCurrency, input.sourceAmountMinor),
    viewerInvolvement: {
      kind,
      amount: money(
        input.sourceCurrency,
        viewerNetMinor < 0n ? -viewerNetMinor : viewerNetMinor,
      ),
    },
  };
}
