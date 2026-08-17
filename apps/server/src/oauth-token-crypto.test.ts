import { describe, expect, it } from "vitest";
import {
  decryptOAuthToken,
  encryptOAuthToken,
  isEncryptedOAuthToken,
} from "./oauth-token-crypto";

const secret = "test-only-secret-with-at-least-thirty-two-characters";

describe("OAuth token encryption", () => {
  it("round-trips Better Auth's legacy bare-hex format", async () => {
    const encrypted = await encryptOAuthToken("provider-token", secret);

    expect(isEncryptedOAuthToken(encrypted)).toBe(true);
    expect(encrypted).not.toBe("provider-token");
    expect(await decryptOAuthToken(encrypted, secret)).toBe("provider-token");
  });

  it("does not encrypt an already encrypted token again", async () => {
    const encrypted = await encryptOAuthToken("provider-token", secret);

    expect(await encryptOAuthToken(encrypted, secret)).toBe(encrypted);
  });

  it("leaves legacy plaintext provider tokens unchanged when decrypting", async () => {
    expect(await decryptOAuthToken("legacy-provider-token", secret)).toBe(
      "legacy-provider-token",
    );
  });
});
