import { serve } from "@hono/node-server";
import { createDatabase, sql } from "@splidly/db";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { startDataRetentionWorker } from "./data-retention";
import { readEnv } from "./env";
import { Logger } from "./logger";
import { startNotificationWorker } from "./notification-worker";

let logger = new Logger();

async function main() {
  const env = readEnv();
  logger = new Logger({ format: env.LOG_FORMAT, level: env.LOG_LEVEL }).child({
    environment: env.NODE_ENV,
  });
  logger.info("server.starting", {
    environment: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    port: env.PORT,
  });
  const { db, pool } = createDatabase(env.DATABASE_URL, {
    logger: {
      logQuery(query, params) {
        logger.debug("database.query", {
          parameterCount: params.length,
          query,
        });
      },
    },
  });
  pool.on("error", (error) => {
    logger.error("database.pool.error", { error });
  });
  pool.on("connect", () => logger.debug("database.pool.connected"));
  pool.on("remove", () => logger.debug("database.pool.connection-removed"));
  const databaseWarmupStartedAt = performance.now();
  await db.execute(sql`select 1`);
  logger.info("database.pool.warmed", {
    durationMs: Math.round((performance.now() - databaseWarmupStartedAt) * 100) /
      100,
  });

  const auth = await createAuth(db, env, logger.child({ component: "auth" }));
  const app = createApp({ auth, db, env, logger });
  const dataRetentionWorker = startDataRetentionWorker(
    db,
    logger.child({ component: "data-retention" }),
  );
  const notificationWorker = await startNotificationWorker(
    db,
    env,
    logger.child({ component: "notification-worker" }),
  );

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info("server.listening", { port: info.port });
  });
  server.on("error", (error) => logger.error("server.error", { error }));

  let shuttingDown = false;
  async function shutdown(reason: string, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server.shutdown.started", { reason });
    notificationWorker.stop();
    dataRetentionWorker.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    logger.info("server.shutdown.completed", { reason });
    process.exit(exitCode);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (error) => {
    logger.fatal("process.uncaught-exception", { error });
    void shutdown("uncaughtException", 1);
  });
  process.on("unhandledRejection", (error) => {
    logger.fatal("process.unhandled-rejection", { error });
    void shutdown("unhandledRejection", 1);
  });
  process.on("warning", (warning) => {
    logger.warn("process.warning", { warning });
  });
}

main().catch((error) => {
  logger.fatal("server.startup.failed", { error });
  process.exit(1);
});
