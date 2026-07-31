import {
  and,
  eq,
  expensePayments,
  expenseSplits,
  groupMembers,
  groups,
  inArray,
  isNull,
  notificationOutbox,
  profiles,
  pushInstallations,
  type ExpenseNotificationPayload,
} from "@splidly/db";
import type { DbTransaction } from "./finance";

export type ExpenseNotificationAction = "create" | "update" | "delete";

export function expenseNotificationRecipientIds(input: {
  actorId: string;
  previousParticipantIds?: readonly string[];
  participantIds: readonly string[];
}) {
  return [
    ...new Set([
      ...(input.previousParticipantIds ?? []),
      ...input.participantIds,
    ]),
  ].filter((userId) => userId !== input.actorId);
}

export function buildExpenseNotificationPayload(input: {
  action: ExpenseNotificationAction;
  actorName: string;
  description: string;
  expenseId: string;
  expenseVersion: number;
  groupId: string;
  groupName: string;
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
    title: `Expense ${verb}`,
    body: `${input.actorName} ${verb} “${input.description}” in ${input.groupName}`,
  };
}

export async function loadExpenseParticipantIds(
  tx: DbTransaction,
  expenseId: string,
) {
  const [payments, splits] = await Promise.all([
    tx
      .select({ userId: expensePayments.userId })
      .from(expensePayments)
      .where(eq(expensePayments.expenseId, expenseId)),
    tx
      .select({ userId: expenseSplits.userId })
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId)),
  ]);
  return [...new Set([...payments, ...splits].map((row) => row.userId))];
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
    previousParticipantIds?: readonly string[];
    participantIds: readonly string[];
  },
) {
  const recipientIds = expenseNotificationRecipientIds({
    actorId: input.actorId,
    participantIds: input.participantIds,
    ...(input.previousParticipantIds
      ? { previousParticipantIds: input.previousParticipantIds }
      : {}),
  });
  if (recipientIds.length === 0) return;

  const [[group], [actor], installations] = await Promise.all([
    tx
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, input.groupId))
      .limit(1),
    tx
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, input.actorId))
      .limit(1),
    tx
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
          inArray(pushInstallations.userId, recipientIds),
          eq(pushInstallations.platform, "ios"),
          isNull(pushInstallations.disabledAt),
          isNull(groupMembers.removedAt),
        ),
      ),
  ]);
  if (!group || installations.length === 0) return;

  const payload = buildExpenseNotificationPayload({
    action: input.action,
    actorName: actor?.displayName ?? "A group member",
    description: input.description,
    expenseId: input.expenseId,
    expenseVersion: input.expenseVersion,
    groupId: input.groupId,
    groupName: group.name,
  });
  await tx
    .insert(notificationOutbox)
    .values(
      installations.map((installation) => ({
        eventKey: [
          payload.eventType,
          input.expenseId,
          input.expenseVersion,
          installation.id,
        ].join(":"),
        installationId: installation.id,
        recipientUserId: installation.userId,
        payload,
      })),
    )
    .onConflictDoNothing({ target: notificationOutbox.eventKey });
}
