import "dotenv/config";
import { accounts, createDatabase, eq } from "@splidly/db";
import { encryptOAuthToken } from "./oauth-token-crypto";

const databaseUrl = process.env.DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
}
const encryptionSecret = secret;

async function encryptIfNeeded(value: string | null) {
  if (!value) return value;
  return encryptOAuthToken(value, encryptionSecret);
}

const { db, pool } = createDatabase(databaseUrl);
try {
  const rows = await db
    .select({
      id: accounts.id,
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      idToken: accounts.idToken,
    })
    .from(accounts);
  let encryptedCount = 0;
  for (const row of rows) {
    const accessToken = await encryptIfNeeded(row.accessToken);
    const refreshToken = await encryptIfNeeded(row.refreshToken);
    const idToken = await encryptIfNeeded(row.idToken);
    if (
      accessToken === row.accessToken &&
      refreshToken === row.refreshToken &&
      idToken === row.idToken
    ) {
      continue;
    }
    await db
      .update(accounts)
      .set({ accessToken, refreshToken, idToken, updatedAt: new Date() })
      .where(eq(accounts.id, row.id));
    encryptedCount += 1;
  }
  process.stdout.write(`Encrypted OAuth tokens for ${encryptedCount} account(s).\n`);
} finally {
  await pool.end();
}
