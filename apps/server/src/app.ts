import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq, sql } from "@splidly/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Auth } from "./auth";
import type { Database } from "@splidly/db";
import type { Env } from "./env";
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
}) {
  const app = new Hono();
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

  app.on(["GET", "POST"], "/api/auth/*", (c) =>
    input.auth.handler(c.req.raw),
  );
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
        }),
      onError({ error, path }) {
        console.error("tRPC error", { path, error });
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

