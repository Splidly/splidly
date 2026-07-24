import {
  and,
  eq,
  friendships,
  groupMembers,
  isNull,
  profiles,
  type Database,
} from "@splidly/db";
import { TRPCError } from "@trpc/server";

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function requireProfile(db: Database, user: {
  id: string;
  name: string;
  image?: string | null | undefined;
}) {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(profiles)
    .values({
      userId: user.id,
      displayName: user.name || "New user",
      avatarUrl: user.image ?? null,
      homeCurrency: "EUR",
    })
    .returning();
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return created;
}

export async function requireActiveGroupMember(
  db: Database,
  groupId: string,
  userId: string,
) {
  const [member] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.removedAt),
      ),
    )
    .limit(1);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a group member" });
  }
  return member;
}

export async function requireFriendshipParticipant(
  db: Database,
  friendshipId: string,
  userId: string,
) {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (
    !friendship ||
    (friendship.userLowId !== userId && friendship.userHighId !== userId)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a friend" });
  }
  return friendship;
}

export async function upsertFriendship(
  db: Database,
  a: string,
  b: string,
  createdVia: "group" | "invite",
) {
  if (a === b) return null;
  const [low, high] = orderedPair(a, b);
  const [friendship] = await db
    .insert(friendships)
    .values({
      userLowId: low,
      userHighId: high,
      createdVia,
      removedAt: null,
    })
    .onConflictDoUpdate({
      target: [friendships.userLowId, friendships.userHighId],
      set: { removedAt: null, updatedAt: new Date() },
    })
    .returning();
  return friendship;
}
