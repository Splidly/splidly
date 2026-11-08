import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must point to a dedicated PostgreSQL test database");
}
const server = fileURLToPath(new URL("../apps/server", import.meta.url));
const result = spawnSync(process.execPath, [
  `${server}/node_modules/vitest/vitest.mjs`, "run", "test/group-concurrency.integration.test.ts",
], { cwd: server, stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
