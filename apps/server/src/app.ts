import { randomUUID } from "node:crypto";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq, sql } from "@splidly/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Auth } from "./auth";
import type { Database } from "@splidly/db";
import type { Env } from "./env";
import { durationMs, withLogContext, type Logger } from "./logger";
import {
  deletionPage,
  deletionResultPage,
  invitePage,
  privacyPage,
} from "./pages";
import { appRouter } from "./router";
import { createTrpcContext } from "./trpc";

export function createApp(input: {
  auth: Auth;
  db: Database;
  env: Env;
  logger: Logger;
}) {
  const app = new Hono<{
    Variables: { logger: Logger; requestId: string };
  }>();
  app.use("*", async (c, next) => {
    const suppliedRequestId = c.req.header("x-request-id");
    const requestId =
      suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const logger = input.logger.child({
      requestId,
      httpMethod: c.req.method,
      httpPath: c.req.path,
    });
    const startedAt = performance.now();
    c.set("logger", logger);
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    logger.debug("http.request.started");
    try {
      await withLogContext(
        { requestId, httpMethod: c.req.method, httpPath: c.req.path },
        () => next(),
      );
    } catch (error) {
      logger.error("http.request.unhandled", {
        durationMs: durationMs(startedAt),
        error,
      });
      c.res = c.json(
        { error: "Internal server error", requestId },
        500,
      );
    }

    const fields = {
      durationMs: durationMs(startedAt),
      responseBytes: c.res.headers.get("content-length"),
      status: c.res.status,
    };
    if (c.res.status >= 500) logger.error("http.request.completed", fields);
    else if (c.res.status >= 400) logger.warn("http.request.completed", fields);
    else if (c.req.path.startsWith("/health/")) {
      logger.debug("http.request.completed", fields);
    } else logger.info("http.request.completed", fields);
  });
  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? randomUUID();
    const logger = c.get("logger") ?? input.logger.child({ requestId });
    logger.error("http.request.unhandled", { error });
    return c.json({ error: "Internal server error", requestId }, 500);
  });
  app.use(
    "/trpc/*",
    cors({
      origin: input.env.APP_PUBLIC_URL,
      credentials: true,
      allowHeaders: ["content-type", "cookie"],
    }),
  );

  app.get("/health/live", (c) => c.json({ status: "ok" }));
  app.get("/health/ready", async (c) => {
    await input.db.execute(sql`select 1`);
    return c.json({ status: "ready" });
  });

  app.get("/.well-known/apple-app-site-association", (c) =>
    c.json({
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [`${input.env.IOS_TEAM_ID}.${input.env.IOS_APP_ID}`],
            components: [{ "/": "/invite/*", comment: "Splidly invitations" }],
          },
        ],
      },
    }),
  );
  app.get("/.well-known/assetlinks.json", (c) =>
    c.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: input.env.ANDROID_PACKAGE,
          sha256_cert_fingerprints: input.env.ANDROID_SHA256_FINGERPRINT
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      },
    ]),
  );

  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const startedAt = performance.now();
    const logger = c.get("logger").child({ component: "auth" });
    const response = await input.auth.handler(c.req.raw);
    logger.info("auth.request.completed", {
      durationMs: durationMs(startedAt),
      operation: c.req.path.slice("/api/auth/".length),
      status: response.status,
    });
    return response;
  });
  app.all("/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: () =>
        createTrpcContext({
          auth: input.auth,
          db: input.db,
          env: input.env,
          headers: c.req.raw.headers,
          logger: c.get("logger"),
          requestId: c.get("requestId"),
        }),
      onError({ ctx, error, path, type }) {
        if (ctx) return;
        c.get("logger").error("trpc.context.failed", {
          error,
          procedure: path,
          procedureType: type,
        });
      },
    }),
  );

  app.get("/invite/:token", (c) => {
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return c.notFound();
    return c.html(invitePage(token, input.env));
  });
  app.get("/privacy", (c) => c.html(privacyPage()));
  app.get("/account/delete", async (c) => {
    const session = await input.auth.api.getSession({
      headers: c.req.raw.headers,
    });
    return c.html(deletionPage(Boolean(session?.user)));
  });
  app.post("/account/delete", async (c) => {
    const context = await createTrpcContext({
      auth: input.auth,
      db: input.db,
      env: input.env,
      headers: c.req.raw.headers,
      logger: c.get("logger"),
      requestId: c.get("requestId"),
    });
    if (!context.session?.user) {
      return c.html(deletionResultPage(false, "Please sign in again."), 401);
    }
    try {
      await appRouter.createCaller(context).profile.deleteAccount({
        confirmation: "DELETE",
      });
      return c.html(deletionResultPage(true));
    } catch (error) {
      context.logger.warn("account.delete.failed", { error });
      return c.html(
        deletionResultPage(
          false,
          error instanceof Error ? error.message : undefined,
        ),
        409,
      );
    }
  });

  return app;
}
