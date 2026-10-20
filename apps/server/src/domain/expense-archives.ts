import {
  and,
  eq,
  friendships,
  groupMembers,
  inArray,
  isNotNull,
  isNull,
  or,
} from "@splidly/db";
import type { ExpenseMutation } from "@splidly/shared";
import type { DbTransaction } from "./finance";

// Called only for a newly inserted expense, inside its financial transaction.
export async function restoreExpenseArchives(
  tx: DbTransaction,
  context: ExpenseMutation["context"],
  financials: {
    payments: ReadonlyMap<string, bigint>;
    sourceShares: ReadonlyMap<string, bigint>;
  },
) {
  if (context.type === "group") {
    await tx
      .update(groupMembers)
      .set({ archivedAt: null })
      .where(
        and(
          eq(groupMembers.groupId, context.groupId),
          isNull(groupMembers.removedAt),
          isNotNull(groupMembers.archivedAt),
        ),
      );
    const ids = [
      ...new Set(
        [...financials.payments, ...financials.sourceShares]
          .filter(([, amount]) => amount > 0n)
          .map(([userId]) => userId),
      ),
    ];
    if (ids.length < 2) return;
    await tx
      .update(friendships)
      .set({ archivedByLowAt: null, archivedByHighAt: null })
      .where(
        and(
          isNull(friendships.removedAt),
          inArray(friendships.userLowId, ids),
          inArray(friendships.userHighId, ids),
          or(
            isNotNull(friendships.archivedByLowAt),
            isNotNull(friendships.archivedByHighAt),
          ),
        ),
      );
  } else {
    await tx
      .update(friendships)
      .set({ archivedByLowAt: null, archivedByHighAt: null })
      .where(
        and(
          eq(friendships.id, context.friendshipId),
          isNull(friendships.removedAt),
        ),
      );
  }
}
