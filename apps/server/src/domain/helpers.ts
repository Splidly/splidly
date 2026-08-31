import {
  and,
  type Database,
  eq,
  friendships,
  groupMembers,
  groups,
  isNull,
  profiles,
} from "@splidly/db";
import { TRPCError } from "@trpc/server";

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function groupBy<T, K>(
  values: Iterable<T>,
  keyFor: (value: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

export async function requireProfile(
  db: Database,
  user: {
    id: string;
    name: string;
    image?: string | null | undefined;
  },
) {
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

export function assertGroupOwner(createdBy: string, userId: string) {
  if (createdBy === userId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Only the group owner can manage this group",
  });
}

export function assertRecordCreator(
  createdBy: string,
  userId: string,
  recordType: "expense" | "settlement",
) {
  if (createdBy === userId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `Only the person who created this ${recordType} can change it`,
  });
}

export async function requireGroupOwner(
  db: Database,
  groupId: string,
  userId: string,
) {
  const [membership] = await db
    .select({ group: groups })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.removedAt),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a group member" });
  }
  assertGroupOwner(membership.group.createdBy, userId);
  return membership.group;
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
