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
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, {
    schema,
    ...(options.logger ? { logger: options.logger } : {}),
  });
  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
