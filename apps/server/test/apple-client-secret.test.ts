import {
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { describe, expect, it } from "vitest";
import { createAppleClientSecret } from "../src/apple-client-secret";

describe("createAppleClientSecret", () => {
  it("creates a 180-day ES256 client secret with Apple claims", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const now = new Date("2026-07-24T12:00:00.000Z");
    const token = await createAppleClientSecret({
      clientId: "com.example.splidly",
      keyId: "KEY123",
      privateKey: await exportPKCS8(privateKey),
      teamId: "TEAM123",
      now,
    });

    const result = await jwtVerify(token, publicKey, {
      algorithms: ["ES256"],
      audience: "https://appleid.apple.com",
      issuer: "TEAM123",
      subject: "com.example.splidly",
      currentDate: now,
    });

    expect(result.protectedHeader).toMatchObject({
      alg: "ES256",
      kid: "KEY123",
    });
    expect(result.payload.exp).toBe(result.payload.iat! + 180 * 24 * 60 * 60);
  });
});
