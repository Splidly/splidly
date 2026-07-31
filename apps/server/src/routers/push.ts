import {
  and,
  eq,
  ne,
  pushInstallations,
} from "@splidly/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const installationSchema = z.object({
  installationId: z.uuid(),
  environment: z.enum(["development", "production"]),
  token: z.string().trim().min(32).max(512),
});

export const pushRouter = router({
  register: protectedProcedure
    .input(installationSchema)
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.env.APNS_ENVIRONMENT &&
        input.environment !== ctx.env.APNS_ENVIRONMENT
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This server does not accept tokens from that APNs environment",
        });
      }

      return ctx.db.transaction(async (tx) => {
        await tx
          .delete(pushInstallations)
          .where(
            and(
              eq(pushInstallations.token, input.token),
              ne(pushInstallations.id, input.installationId),
            ),
          );
        const now = new Date();
        const [installation] = await tx
          .insert(pushInstallations)
          .values({
            id: input.installationId,
            userId: ctx.session.user.id,
            platform: "ios",
            environment: input.environment,
            token: input.token,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: pushInstallations.id,
            set: {
              userId: ctx.session.user.id,
              platform: "ios",
              environment: input.environment,
              token: input.token,
              disabledAt: null,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
          .returning({ id: pushInstallations.id });
        return installation ?? { id: input.installationId };
      });
    }),

  unregister: protectedProcedure
    .input(z.object({ installationId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushInstallations)
        .where(
          and(
            eq(pushInstallations.id, input.installationId),
            eq(pushInstallations.userId, ctx.session.user.id),
          ),
        );
      return { unregistered: true };
    }),
});
