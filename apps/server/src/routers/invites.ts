import {
  and,
  eq,
  friendships,
  groupMembers,
  groups,
  invites,
  isNull,
  profiles,
} from "@splidly/db";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  orderedPair,
  requireActiveGroupMember,
  requireGroupOwner,
} from "../domain/helpers";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function readInvite(
  db: Parameters<typeof requireActiveGroupMember>[0],
  token: string,
) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.tokenHash, hashInviteToken(token)))
    .limit(1);
  if (
    !invite ||
    invite.revokedAt ||
    invite.expiresAt.getTime() <= Date.now() ||
    invite.usedAt
  ) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This invite is invalid or expired",
    });
  }
  return invite;
}

export const invitesRouter = router({
  preview: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .query(async ({ ctx, input }) => {
      const invite = await readInvite(ctx.db, input.token);
      const [inviterRows, groupRows] = await Promise.all([
        ctx.db
          .select({
            userId: profiles.userId,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
          })
          .from(profiles)
          .where(eq(profiles.userId, invite.inviterId))
          .limit(1),
        invite.groupId
          ? ctx.db
              .select({
                id: groups.id,
                name: groups.name,
                iconKey: groups.iconKey,
                color: groups.color,
                imageUrl: groups.imageUrl,
                currency: groups.currency,
              })
              .from(groups)
              .where(eq(groups.id, invite.groupId))
              .limit(1)
          : Promise.resolve([]),
      ]);
      const inviter = inviterRows[0];
      const group = groupRows[0];
      return {
        kind: invite.kind as "group" | "friend",
        inviter,
        group: group ?? null,
        expiresAt: invite.expiresAt,
      };
    }),

  create: protectedProcedure
    .input(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("friend") }),
        z.object({ kind: z.literal("group"), groupId: z.uuid() }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === "group") {
        await requireGroupOwner(
          ctx.db,
          input.groupId,
          ctx.session.user.id,
        );
      }
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1_000,
      );
      const [invite] = await ctx.db
        .insert(invites)
        .values({
          kind: input.kind,
          tokenHash: hashInviteToken(token),
          inviterId: ctx.session.user.id,
          groupId: input.kind === "group" ? input.groupId : null,
          expiresAt,
        })
        .returning();
      if (!invite) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return {
        id: invite.id,
        url: `${ctx.env.APP_PUBLIC_URL}/invite/${token}`,
        expiresAt,
      };
    }),

  list: protectedProcedure
    .input(z.object({ groupId: z.uuid().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.groupId) {
        await requireActiveGroupMember(
          ctx.db,
          input.groupId,
          ctx.session.user.id,
        );
        return ctx.db
          .select({
            id: invites.id,
            kind: invites.kind,
            expiresAt: invites.expiresAt,
            usedAt: invites.usedAt,
            revokedAt: invites.revokedAt,
            createdAt: invites.createdAt,
          })
          .from(invites)
          .where(eq(invites.groupId, input.groupId));
      }
      return ctx.db
        .select({
          id: invites.id,
          kind: invites.kind,
          expiresAt: invites.expiresAt,
          usedAt: invites.usedAt,
          revokedAt: invites.revokedAt,
          createdAt: invites.createdAt,
        })
        .from(invites)
        .where(eq(invites.inviterId, ctx.session.user.id));
    }),

  revoke: protectedProcedure
    .input(z.object({ inviteId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [invite] = await ctx.db
        .select()
        .from(invites)
        .where(eq(invites.id, input.inviteId))
        .limit(1);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      if (invite.groupId) {
        await requireGroupOwner(
          ctx.db,
          invite.groupId,
          ctx.session.user.id,
        );
      } else if (invite.inviterId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db
        .update(invites)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(invites.id, input.inviteId));
      return { revoked: true };
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await readInvite(ctx.db, input.token);
      const acceptingId = ctx.session.user.id;
      if (invite.inviterId === acceptingId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot accept your own invite",
        });
      }

      return ctx.db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(invites)
          .set({ usedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(invites.id, invite.id),
              isNull(invites.usedAt),
              isNull(invites.revokedAt),
            ),
          )
          .returning({ id: invites.id });
        if (!claimed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This invite was already used",
          });
        }
        if (invite.kind === "friend") {
          const [low, high] = orderedPair(invite.inviterId, acceptingId);
          const [friendship] = await tx
            .insert(friendships)
            .values({
              userLowId: low,
              userHighId: high,
              createdVia: "invite",
            })
            .onConflictDoUpdate({
              target: [friendships.userLowId, friendships.userHighId],
              set: { removedAt: null, updatedAt: new Date() },
            })
            .returning();
          return { kind: "friend" as const, friendshipId: friendship?.id };
        }

        if (!invite.groupId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        await tx
          .insert(groupMembers)
          .values({ groupId: invite.groupId, userId: acceptingId })
          .onConflictDoUpdate({
            target: [groupMembers.groupId, groupMembers.userId],
            set: { removedAt: null, joinedAt: new Date() },
          });
        const existingMembers = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
          .where(
            and(
              eq(groupMembers.groupId, invite.groupId),
              isNull(groupMembers.removedAt),
              isNull(profiles.deletedAt),
            ),
          );
        const friendshipsToUpsert = existingMembers.flatMap((member) => {
          if (member.userId === acceptingId) return [];
          const [userLowId, userHighId] = orderedPair(
            member.userId,
            acceptingId,
          );
          return [
            {
              userLowId,
              userHighId,
              createdVia: "group",
            },
          ];
        });
        if (friendshipsToUpsert.length > 0) {
          await tx
            .insert(friendships)
            .values(friendshipsToUpsert)
            .onConflictDoUpdate({
              target: [friendships.userLowId, friendships.userHighId],
              set: { removedAt: null, updatedAt: new Date() },
            });
        }
        return { kind: "group" as const, groupId: invite.groupId };
      });
    }),
});
