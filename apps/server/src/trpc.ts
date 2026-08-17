import type { Database } from "@splidly/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Auth } from "./auth";
import type { Env } from "./env";
import { durationMs, type Logger } from "./logger";

export interface TrpcContext {
  auth: Auth;
  db: Database;
  env: Env;
  headers: Headers;
  logger: Logger;
  requestId: string;
  session: Awaited<ReturnType<Auth["api"]["getSession"]>>;
}

export async function createTrpcContext(input: {
  auth: Auth;
  db: Database;
  env: Env;
  headers: Headers;
  logger: Logger;
  requestId: string;
}): Promise<TrpcContext> {
  const startedAt = performance.now();
  let session: TrpcContext["session"];
  try {
    session = await input.auth.api.getSession({ headers: input.headers });
  } catch (error) {
    input.logger.error("auth.session.failed", {
      durationMs: durationMs(startedAt),
      error,
    });
    throw error;
  }
  const logger = session?.user
    ? input.logger.child({ userId: session.user.id })
    : input.logger;
  logger.debug("auth.session.resolved", {
    authenticated: Boolean(session?.user),
    durationMs: durationMs(startedAt),
  });
  return {
    ...input,
    logger,
    session,
  };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.code !== "INTERNAL_SERVER_ERROR") return shape;
    return { ...shape, message: "Internal server error" };
  },
});

export const router = t.router;
const slowProcedureThresholdMs = 500;
const observedProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  const startedAt = performance.now();
  const logger = ctx.logger.child({ procedure: path, procedureType: type });
  logger.debug("trpc.procedure.started");
  const result = await next({ ctx: { ...ctx, logger } });
  const fields = { durationMs: durationMs(startedAt) };
  if (result.ok) {
    if (fields.durationMs >= slowProcedureThresholdMs) {
      logger.warn("trpc.procedure.slow", {
        ...fields,
        thresholdMs: slowProcedureThresholdMs,
      });
    } else {
      logger.info("trpc.procedure.completed", fields);
    }
  } else {
    const errorFields = {
      ...fields,
      errorCode: result.error.code,
      error: result.error,
    };
    if (result.error.code === "INTERNAL_SERVER_ERROR") {
      logger.error("trpc.procedure.failed", errorFields);
    } else {
      logger.warn("trpc.procedure.failed", errorFields);
    }
  }
  return result;
});

export const publicProcedure = observedProcedure;
export const protectedProcedure = observedProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    ctx.logger.warn("auth.authorization.denied", {
      reason: "missing-session",
    });
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

export const recentSessionMaxAgeMs = 15 * 60 * 1_000;

export function isRecentSession(
  createdAt: Date | string,
  now = new Date(),
): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < recentSessionMaxAgeMs;
}

export const recentProtectedProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    if (!isRecentSession(ctx.session.session.createdAt)) {
      ctx.logger.warn("auth.authorization.denied", {
        reason: "session-not-recent",
      });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sign in again before deleting your account",
      });
    }
    return next({ ctx });
  },
);
