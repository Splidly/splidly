import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

export function isEncryptedOAuthToken(token: string): boolean {
  return (
    token.startsWith("$ba$") ||
    (token.length > 0 && token.length % 2 === 0 && /^[0-9a-f]+$/i.test(token))
  );
}

export async function encryptOAuthToken(
  token: string,
  secret: string,
): Promise<string> {
  if (isEncryptedOAuthToken(token)) return token;
  return symmetricEncrypt({ key: secret, data: token });
}

export async function decryptOAuthToken(
  token: string,
  secret: string,
): Promise<string> {
  if (!isEncryptedOAuthToken(token)) return token;
  return symmetricDecrypt({ key: secret, data: token });
}
