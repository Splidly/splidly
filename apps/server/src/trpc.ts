import type { Database } from "@splidly/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Auth } from "./auth";
import type { Env } from "./env";

export interface TrpcContext {
  auth: Auth;
  db: Database;
  env: Env;
  headers: Headers;
  session: Awaited<ReturnType<Auth["api"]["getSession"]>>;
}

export async function createTrpcContext(input: {
  auth: Auth;
  db: Database;
  env: Env;
  headers: Headers;
}): Promise<TrpcContext> {
  return {
    ...input,
    session: await input.auth.api.getSession({ headers: input.headers }),
  };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
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

