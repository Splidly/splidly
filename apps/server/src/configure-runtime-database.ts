import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const runtimeUser = process.env.POSTGRES_RUNTIME_USER ?? "splidly_app";
const runtimePassword = process.env.POSTGRES_RUNTIME_PASSWORD;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(runtimeUser)) {
  throw new Error("POSTGRES_RUNTIME_USER must be a simple PostgreSQL role name");
}
if (!runtimePassword || !/^[A-Za-z0-9_-]{24,}$/.test(runtimePassword)) {
  throw new Error(
    "POSTGRES_RUNTIME_PASSWORD must be at least 24 URL-safe base64 characters",
  );
}

const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(databaseName)) {
  throw new Error("The production database must use a simple identifier");
}
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const role = identifier(runtimeUser);

const pool = new Pool({ connectionString: databaseUrl });
try {
  const existing = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from pg_roles where rolname = $1) as exists",
    [runtimeUser],
  );
  if (!existing.rows[0]?.exists) {
    await pool.query(`create role ${role} login`);
  }
  await pool.query(
    `alter role ${role} with login password ${literal(runtimePassword)} nosuperuser nocreatedb nocreaterole noreplication`,
  );
  await pool.query(
    `grant connect on database ${identifier(databaseName)} to ${role}`,
  );
  await pool.query(`grant usage on schema public to ${role}`);
  await pool.query(`revoke create on schema public from ${role}`);
  await pool.query(
    `grant select, insert, update, delete on all tables in schema public to ${role}`,
  );
  await pool.query(
    `grant usage, select on all sequences in schema public to ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public grant usage, select on sequences to ${role}`,
  );
  process.stdout.write(`Configured restricted database role ${runtimeUser}.\n`);
} finally {
  await pool.end();
}
