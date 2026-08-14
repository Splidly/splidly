import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

export * from "drizzle-orm";
export * from "./schema";

export interface DatabaseQueryLogger {
  logQuery(query: string, params: unknown[]): void;
}

export function createDatabase(
  databaseUrl: string,
  options: { logger?: DatabaseQueryLogger } = {},
) {
  const pool = new Pool({
    connectionString: databaseUrl,
    // Keep one established connection warm. The pg defaults can retire every
    // idle connection after ten seconds, making the next mobile action pay for
    // a fresh DNS/TCP/TLS/database handshake.
    min: 1,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  const db = drizzle(pool, {
    schema,
    ...(options.logger ? { logger: options.logger } : {}),
  });
  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
