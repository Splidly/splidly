import {
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { describe, expect, it } from "vitest";
import { createApnsProviderToken } from "../src/apns";
import { classifyApnsResponse } from "../src/notification-worker";

describe("APNs authentication", () => {
  it("creates an ES256 provider token with the APNs team and key IDs", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const now = new Date("2026-07-31T12:00:00.000Z");
    const token = await createApnsProviderToken({
      keyId: "APNSKEY123",
      privateKey: await exportPKCS8(privateKey),
      teamId: "TEAM123456",
      now,
    });

    const result = await jwtVerify(token, publicKey, {
      algorithms: ["ES256"],
      issuer: "TEAM123456",
      currentDate: now,
    });
    expect(result.protectedHeader).toMatchObject({
      alg: "ES256",
      kid: "APNSKEY123",
    });
    expect(result.payload.iat).toBe(Math.floor(now.getTime() / 1_000));
  });
});

describe("APNs response classification", () => {
  it("retires invalid installations without retrying them", () => {
    expect(
      classifyApnsResponse({ status: 410, reason: "Unregistered" }),
    ).toBe("invalid-token");
    expect(
      classifyApnsResponse({ status: 400, reason: "BadDeviceToken" }),
    ).toBe("invalid-token");
  });

  it("retries provider throttling and server failures", () => {
    expect(classifyApnsResponse({ status: 429 })).toBe("retry");
    expect(classifyApnsResponse({ status: 503 })).toBe("retry");
    expect(classifyApnsResponse({ status: 200 })).toBe("delivered");
  });

  it("does not retry a permanently invalid payload", () => {
    expect(
      classifyApnsResponse({ status: 400, reason: "PayloadEmpty" }),
    ).toBe("failed");
  });
});
