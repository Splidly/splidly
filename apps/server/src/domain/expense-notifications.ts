import {
  and,
  eq,
  type ExpenseEventNotificationPayload,
  type ExpenseNotificationPayload,
  expensePayments,
  expenseSplits,
  groupMembers,
  groups,
  isNull,
  ne,
  notificationOutbox,
  profiles,
  pushInstallations,
} from "@splidly/db";
import { type CurrencyCode, formatMinor } from "@splidly/shared";
import type { DbTransaction } from "./finance";

export type ExpenseNotificationAction = "create" | "update" | "delete";

export type ExpenseNotificationInstallation = {
  id: string;
  userId: string;
  notificationOnlyWhenInvolved: boolean;
  summarizeNotificationBursts: boolean;
};

export const smartNotificationWindowMs = 5 * 60 * 1_000;
export const smartNotificationThreshold = 3;

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
    return `You ${deleted ? "owed" : "owe"} ${notificationMoney(
      -netMinor,
      input.currency,
    )}`;
  }
  if (netMinor > 0n) {
    return `You ${deleted ? "were owed" : "are owed"} ${notificationMoney(
      netMinor,
      input.currency,
    )}`;
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
}): ExpenseEventNotificationPayload {
  const verb =
    input.action === "create"
      ? "added"
      : input.action === "update"
        ? "updated"
        : "deleted";
  return {
    eventType: `expense.${
      input.action === "create"
        ? "created"
        : input.action === "update"
          ? "updated"
          : "deleted"
    }`,
    expenseId: input.expenseId,
    expenseVersion: input.expenseVersion,
    groupId: input.groupId,
    groupName: input.groupName,
    title: `${input.actorName} ${verb} “${input.description}”`,
    body: `${input.action === "delete" ? "Total was" : "Total"} ${notificationMoney(
      input.sourceAmountMinor,
      input.sourceCurrency,
    )} in ${input.groupName} · ${expenseNotificationInvolvement({
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

export function buildExpenseSummaryNotificationPayload(
  payloads: ExpenseEventNotificationPayload[],
): ExpenseNotificationPayload | undefined {
  if (payloads.length < smartNotificationThreshold) return undefined;
  const first = payloads[0];
  if (!first) throw new Error("Cannot summarize an empty notification burst");
  if (payloads.some((payload) => payload.groupId !== first.groupId)) {
    throw new Error("Cannot summarize notifications from different groups");
  }
  const eventCount = payloads.length;
  return {
    eventType: "expense.summary",
    groupId: first.groupId,
    groupName: first.groupName,
    eventCount,
    title: `${eventCount} expense updates in ${first.groupName}`,
    body: "Recent activity was grouped to keep notifications manageable.",
  };
}

export function isExpenseRecipientInvolved(input: {
  paymentMinor?: bigint;
  shareMinor?: bigint;
}) {
  return input.paymentMinor !== undefined || input.shareMinor !== undefined;
}

export async function enqueueExpenseNotifications(
  tx: DbTransaction,
  input: {
    action: ExpenseNotificationAction;
    actorId: string;
    actorName?: string;
    description: string;
    expenseId: string;
    expenseVersion: number;
    groupId: string;
    groupName?: string;
    payments?: ReadonlyMap<string, bigint>;
    splits?: ReadonlyMap<string, bigint>;
    sourceAmountMinor: bigint;
    sourceCurrency: CurrencyCode;
    installations?: readonly ExpenseNotificationInstallation[];
  },
) {
  const [group] = input.groupName
    ? [{ name: input.groupName }]
    : await tx
        .select({ name: groups.name })
        .from(groups)
        .where(eq(groups.id, input.groupId))
        .limit(1);
  const [actor] = input.actorName
    ? [{ displayName: input.actorName }]
    : await tx
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.userId, input.actorId))
        .limit(1);
  const installations =
    input.installations ??
    (await tx
      .select({
        id: pushInstallations.id,
        userId: pushInstallations.userId,
        notificationOnlyWhenInvolved: profiles.notificationOnlyWhenInvolved,
        summarizeNotificationBursts: profiles.summarizeNotificationBursts,
      })
      .from(pushInstallations)
      .innerJoin(
        groupMembers,
        and(
          eq(groupMembers.userId, pushInstallations.userId),
          eq(groupMembers.groupId, input.groupId),
        ),
      )
      .innerJoin(profiles, eq(profiles.userId, pushInstallations.userId))
      .where(
        and(
          ne(pushInstallations.userId, input.actorId),
          eq(pushInstallations.platform, "ios"),
          isNull(pushInstallations.disabledAt),
          isNull(groupMembers.removedAt),
        ),
      ));
  if (!group || installations.length === 0) return;

  const payments =
    input.payments ??
    new Map(
      (
        await tx
          .select({
            amountMinor: expensePayments.sourceAmountMinor,
            userId: expensePayments.userId,
          })
          .from(expensePayments)
          .where(eq(expensePayments.expenseId, input.expenseId))
      ).map((payment) => [payment.userId, payment.amountMinor]),
    );
  const splits =
    input.splits ??
    new Map(
      (
        await tx
          .select({
            amountMinor: expenseSplits.sourceAmountMinor,
            userId: expenseSplits.userId,
          })
          .from(expenseSplits)
          .where(eq(expenseSplits.expenseId, input.expenseId))
      ).map((split) => [split.userId, split.amountMinor]),
    );

  const now = new Date();
  const notificationRows = installations.flatMap((installation) => {
    const recipientPaymentMinor = payments.get(installation.userId);
    const recipientShareMinor = splits.get(installation.userId);
    if (
      installation.notificationOnlyWhenInvolved &&
      !isExpenseRecipientInvolved({
        ...(recipientPaymentMinor !== undefined
          ? { paymentMinor: recipientPaymentMinor }
          : {}),
        ...(recipientShareMinor !== undefined
          ? { shareMinor: recipientShareMinor }
          : {}),
      })
    ) {
      return [];
    }
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
      ...(recipientPaymentMinor !== undefined ? { recipientPaymentMinor } : {}),
      ...(recipientShareMinor !== undefined ? { recipientShareMinor } : {}),
    });
    return [
      {
        eventKey: [
          payload.eventType,
          input.expenseId,
          input.expenseVersion,
          installation.id,
        ].join(":"),
        installationId: installation.id,
        recipientUserId: installation.userId,
        payload,
        deliveryMode: installation.summarizeNotificationBursts
          ? ("smart" as const)
          : ("immediate" as const),
        availableAt: installation.summarizeNotificationBursts
          ? new Date(now.getTime() + smartNotificationWindowMs)
          : now,
      },
    ];
  });
  if (notificationRows.length === 0) return;

  await tx
    .insert(notificationOutbox)
    .values(notificationRows)
    .onConflictDoNothing({ target: notificationOutbox.eventKey });
}
