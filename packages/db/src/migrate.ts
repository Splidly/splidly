import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./index";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const { db, pool } = createDatabase(databaseUrl);
await migrate(db, {
  migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
});
await pool.end();

