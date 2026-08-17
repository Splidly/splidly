import {
  accounts,
  and,
  currencyQuotes,
  eq,
  groupMembers,
  groups,
  inArray,
  invites,
  isNull,
  ledgerValuations,
  notificationOutbox,
  profiles,
  pushInstallations,
  sessions,
  sql,
  users,
  verifications,
} from "@splidly/db";
import {
  currencyCodeSchema,
  customImageDataUrlSchema,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireProfile } from "../domain/helpers";
import {
  protectedProcedure,
  recentProtectedProcedure,
  router,
} from "../trpc";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) =>
    requireProfile(ctx.db, ctx.session.user),
  ),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().trim().min(1).max(80),
        avatarUrl: customImageDataUrlSchema.nullable().optional(),
        homeCurrency: currencyCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProfile(ctx.db, ctx.session.user);
      const [profile] = await ctx.db
        .update(profiles)
        .set({
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          homeCurrency: input.homeCurrency,
          onboardedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(profiles.userId, ctx.session.user.id),
            isNull(profiles.deletedAt),
          ),
        )
        .returning();
      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile no longer exists",
        });
      }
      return profile;
    }),

  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        onlyWhenInvolved: z.boolean(),
        summarizeBursts: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProfile(ctx.db, ctx.session.user);
      const [profile] = await ctx.db
        .update(profiles)
        .set({
          notificationOnlyWhenInvolved: input.onlyWhenInvolved,
          summarizeNotificationBursts: input.summarizeBursts,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(profiles.userId, ctx.session.user.id),
            isNull(profiles.deletedAt),
          ),
        )
        .returning();
      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile no longer exists",
        });
      }
      return profile;
    }),

  deleteAccount: recentProtectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE"),
      }),
    )
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const tombstone = `deleted-${crypto.randomUUID()}@invalid.splidly`;
      const providerAccounts = await ctx.db
        .select({
          providerId: accounts.providerId,
          accessToken: accounts.accessToken,
          refreshToken: accounts.refreshToken,
        })
        .from(accounts)
        .where(eq(accounts.userId, userId));
      let manualAppleRevocationRequired = false;
      for (const account of providerAccounts) {
        if (account.providerId !== "apple") continue;
        const storedToken = account.refreshToken ?? account.accessToken;
        if (!storedToken) {
          manualAppleRevocationRequired = true;
          continue;
        }
        try {
          const token = await ctx.auth.decryptOAuthToken(storedToken);
          await ctx.auth.revokeAppleToken({
            token,
            tokenType: account.refreshToken
              ? "refresh_token"
              : "access_token",
          });
        } catch (cause) {
          ctx.logger.error("account.delete.apple-revocation-failed", {
            cause,
          });
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message:
              "Apple authorization could not be revoked. Please try again.",
          });
        }
      }

      return ctx.db.transaction(async (tx) => {
        const activeMemberships = await tx
          .select({ groupId: groupMembers.groupId })
          .from(groupMembers)
          .innerJoin(groups, eq(groups.id, groupMembers.groupId))
          .where(
            and(
              eq(groupMembers.userId, userId),
              isNull(groupMembers.removedAt),
              isNull(groups.archivedAt),
            ),
          );
        const deletedAt = new Date();
        const activeGroupIds = activeMemberships.map(
          (membership) => membership.groupId,
        );
        if (activeGroupIds.length > 0) {
          const groupMemberships = await tx
            .select({
              groupId: groupMembers.groupId,
              userId: groupMembers.userId,
              joinedAt: groupMembers.joinedAt,
              memberDeletedAt: profiles.deletedAt,
            })
            .from(groupMembers)
            .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
            .where(
              and(
                inArray(groupMembers.groupId, activeGroupIds),
                isNull(groupMembers.removedAt),
              ),
            );
          const groupsWithOtherMembers = new Set(
            groupMemberships
              .filter(
                (membership) =>
                  membership.userId !== userId && !membership.memberDeletedAt,
              )
              .map((membership) => membership.groupId),
          );
          const groupsToArchive = activeGroupIds.filter(
            (groupId) => !groupsWithOtherMembers.has(groupId),
          );
          const successorByGroup = new Map<string, string>();
          for (const membership of groupMemberships
            .filter(
              (membership) =>
                membership.userId !== userId && !membership.memberDeletedAt,
            )
            .sort(
              (left, right) =>
                left.joinedAt.getTime() - right.joinedAt.getTime(),
            )) {
            if (!successorByGroup.has(membership.groupId)) {
              successorByGroup.set(membership.groupId, membership.userId);
            }
          }
          if (groupsToArchive.length > 0) {
            await tx
              .update(groups)
              .set({
                archivedAt: deletedAt,
                updatedAt: deletedAt,
                version: sql`${groups.version} + 1`,
              })
              .where(inArray(groups.id, groupsToArchive));
          }
          for (const [groupId, successorId] of successorByGroup) {
            await tx
              .update(groups)
              .set({
                createdBy: successorId,
                updatedAt: deletedAt,
                version: sql`${groups.version} + 1`,
              })
              .where(
                and(eq(groups.id, groupId), eq(groups.createdBy, userId)),
              );
          }
        }

        await tx.delete(invites).where(eq(invites.inviterId, userId));
        await tx
          .delete(notificationOutbox)
          .where(eq(notificationOutbox.recipientUserId, userId));
        await tx
          .delete(pushInstallations)
          .where(eq(pushInstallations.userId, userId));
        await tx.delete(currencyQuotes).where(eq(currencyQuotes.userId, userId));
        await tx
          .delete(ledgerValuations)
          .where(eq(ledgerValuations.userId, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx
          .delete(verifications)
          .where(
            inArray(verifications.identifier, [
              userId,
              ctx.session.user.email,
            ]),
          );
        await tx
          .update(profiles)
          .set({
            displayName: "Deleted user",
            avatarUrl: null,
            homeCurrency: "EUR",
            notificationOnlyWhenInvolved: false,
            summarizeNotificationBursts: false,
            onboardedAt: null,
            deletedAt,
            updatedAt: deletedAt,
          })
          .where(eq(profiles.userId, userId));
        await tx
          .update(users)
          .set({
            name: "Deleted user",
            email: tombstone,
            image: null,
            updatedAt: deletedAt,
          })
          .where(eq(users.id, userId));
        return { deleted: true, manualAppleRevocationRequired };
      });
    }),
});
