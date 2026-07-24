import { readFile } from "node:fs/promises";
import { importPKCS8, SignJWT } from "jose";

const clientSecretLifetimeSeconds = 180 * 24 * 60 * 60;

export interface AppleClientSecretInput {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
  now?: Date;
}

export async function createAppleClientSecret(
  input: AppleClientSecretInput,
): Promise<string> {
  const key = await importPKCS8(input.privateKey, "ES256");
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1_000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: input.keyId })
    .setIssuer(input.teamId)
    .setSubject(input.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + clientSecretLifetimeSeconds)
    .sign(key);
}

export async function createAppleClientSecretFromFile(
  input: Omit<AppleClientSecretInput, "privateKey"> & {
    privateKeyPath: string;
  },
): Promise<string> {
  let privateKey: string;
  try {
    privateKey = await readFile(input.privateKeyPath, "utf8");
  } catch (cause) {
    throw new Error(
      `Unable to read the Sign in with Apple private key at ${input.privateKeyPath}`,
      { cause },
    );
  }

  return createAppleClientSecret({
    clientId: input.clientId,
    keyId: input.keyId,
    privateKey,
    teamId: input.teamId,
    ...(input.now ? { now: input.now } : {}),
  });
}
