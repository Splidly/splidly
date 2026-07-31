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
});

export const router = t.router;
const observedProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  const startedAt = performance.now();
  const logger = ctx.logger.child({ procedure: path, procedureType: type });
  logger.debug("trpc.procedure.started");
  const result = await next({ ctx: { ...ctx, logger } });
  const fields = { durationMs: durationMs(startedAt) };
  if (result.ok) {
    logger.info("trpc.procedure.completed", fields);
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
