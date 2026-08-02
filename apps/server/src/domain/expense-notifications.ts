import {
  and,
  eq,
  expensePayments,
  expenseSplits,
  groupMembers,
  groups,
  isNull,
  ne,
  notificationOutbox,
  profiles,
  pushInstallations,
  type ExpenseNotificationPayload,
} from "@splidly/db";
import { formatMinor, type CurrencyCode } from "@splidly/shared";
import type { DbTransaction } from "./finance";

export type ExpenseNotificationAction = "create" | "update" | "delete";

function notificationMoney(amountMinor: bigint, currency: CurrencyCode) {
  return `${formatMinor(amountMinor, currency)} ${currency}`;
}

export function expenseNotificationInvolvement(input: {
  action: ExpenseNotificationAction;
  currency: CurrencyCode;
  paymentMinor?: bigint;
  shareMinor?: bigint;
}) {
  const paymentMinor = input.paymentMinor ?? 0n;
  const shareMinor = input.shareMinor ?? 0n;
  const netMinor = paymentMinor - shareMinor;
  const deleted = input.action === "delete";

  if (netMinor < 0n) {
    return `You ${deleted ? "owed" : "owe"} ${notificationMoney(-netMinor, input.currency)}`;
  }
  if (netMinor > 0n) {
    return `You ${deleted ? "were owed" : "are owed"} ${notificationMoney(netMinor, input.currency)}`;
  }
  if (input.paymentMinor !== undefined || input.shareMinor !== undefined) {
    const amount = notificationMoney(shareMinor, input.currency);
    return deleted
      ? `You had paid your ${amount} share`
      : `You paid your ${amount} share`;
  }
  return deleted ? "You weren't involved" : "You're not involved";
}

export function buildExpenseNotificationPayload(input: {
  action: ExpenseNotificationAction;
  actorName: string;
  description: string;
  expenseId: string;
  expenseVersion: number;
  groupId: string;
  groupName: string;
  recipientPaymentMinor?: bigint;
  recipientShareMinor?: bigint;
  sourceAmountMinor: bigint;
  sourceCurrency: CurrencyCode;
}): ExpenseNotificationPayload {
  const verb =
    input.action === "create"
      ? "added"
      : input.action === "update"
        ? "updated"
        : "deleted";
  return {
    eventType: `expense.${input.action === "create" ? "created" : input.action === "update" ? "updated" : "deleted"}`,
    expenseId: input.expenseId,
    expenseVersion: input.expenseVersion,
    groupId: input.groupId,
    title: `${input.actorName} ${verb} “${input.description}”`,
    body: `${input.action === "delete" ? "Total was" : "Total"} ${notificationMoney(input.sourceAmountMinor, input.sourceCurrency)} in ${input.groupName} · ${expenseNotificationInvolvement({
      action: input.action,
      currency: input.sourceCurrency,
      ...(input.recipientPaymentMinor !== undefined
        ? { paymentMinor: input.recipientPaymentMinor }
        : {}),
      ...(input.recipientShareMinor !== undefined
        ? { shareMinor: input.recipientShareMinor }
        : {}),
    })}`,
  };
}

export async function enqueueExpenseNotifications(
  tx: DbTransaction,
  input: {
    action: ExpenseNotificationAction;
    actorId: string;
    description: string;
    expenseId: string;
    expenseVersion: number;
    groupId: string;
    sourceAmountMinor: bigint;
    sourceCurrency: CurrencyCode;
  },
) {
  const [group] = await tx
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, input.groupId))
    .limit(1);
  const [actor] = await tx
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, input.actorId))
    .limit(1);
  const installations = await tx
    .select({
      id: pushInstallations.id,
      userId: pushInstallations.userId,
    })
    .from(pushInstallations)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.userId, pushInstallations.userId),
        eq(groupMembers.groupId, input.groupId),
      ),
    )
    .where(
      and(
        ne(pushInstallations.userId, input.actorId),
        eq(pushInstallations.platform, "ios"),
        isNull(pushInstallations.disabledAt),
        isNull(groupMembers.removedAt),
      ),
    );
  if (!group || installations.length === 0) return;

  const paymentRows = await tx
    .select({
      amountMinor: expensePayments.sourceAmountMinor,
      userId: expensePayments.userId,
    })
    .from(expensePayments)
    .where(eq(expensePayments.expenseId, input.expenseId));
  const splitRows = await tx
    .select({
      amountMinor: expenseSplits.sourceAmountMinor,
      userId: expenseSplits.userId,
    })
    .from(expenseSplits)
    .where(eq(expenseSplits.expenseId, input.expenseId));
  const payments = new Map(
    paymentRows.map((payment) => [payment.userId, payment.amountMinor]),
  );
  const splits = new Map(
    splitRows.map((split) => [split.userId, split.amountMinor]),
  );

  await tx
    .insert(notificationOutbox)
    .values(
      installations.map((installation) => {
        const payload = buildExpenseNotificationPayload({
          action: input.action,
          actorName: actor?.displayName ?? "A group member",
          description: input.description,
          expenseId: input.expenseId,
          expenseVersion: input.expenseVersion,
          groupId: input.groupId,
          groupName: group.name,
          sourceAmountMinor: input.sourceAmountMinor,
          sourceCurrency: input.sourceCurrency,
          ...(payments.has(installation.userId)
            ? { recipientPaymentMinor: payments.get(installation.userId)! }
            : {}),
          ...(splits.has(installation.userId)
            ? { recipientShareMinor: splits.get(installation.userId)! }
            : {}),
        });
        return {
          eventKey: [
            payload.eventType,
            input.expenseId,
            input.expenseVersion,
            installation.id,
          ].join(":"),
          installationId: installation.id,
          recipientUserId: installation.userId,
          payload,
        };
      }),
    )
    .onConflictDoNothing({ target: notificationOutbox.eventKey });
}
