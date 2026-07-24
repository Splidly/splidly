import { serve } from "@hono/node-server";
import { createDatabase } from "@splidly/db";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { readEnv } from "./env";

const env = readEnv();
const { db, pool } = createDatabase(env.DATABASE_URL);
const auth = await createAuth(db, env);
const app = createApp({ auth, db, env });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Splidly server listening on http://localhost:${info.port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
