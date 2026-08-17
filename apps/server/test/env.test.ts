import { describe, expect, it } from "vitest";
import { readEnv } from "../src/env";

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:password@localhost:5432/splidly",
  BETTER_AUTH_SECRET: "a".repeat(32),
  API_PUBLIC_URL: "https://api.example.com",
  APP_PUBLIC_URL: "https://app.example.com",
  FRANKFURTER_URL: "https://rates.example.com",
  IOS_APP_ID: "com.example.splidly",
  IOS_TEAM_ID: "TEAM123456",
  ANDROID_PACKAGE: "com.example.splidly",
  ANDROID_SHA256_FINGERPRINT: "AA:BB",
  IOS_STORE_URL: "https://apps.apple.com/app/id123",
  ANDROID_STORE_URL: "https://play.google.com/store/apps/details?id=test",
};

describe("server environment", () => {
  it("defaults to JSON info logging and accepts development overrides", () => {
    expect(readEnv(baseEnv).LOG_LEVEL).toBe("info");
    expect(readEnv(baseEnv).LOG_FORMAT).toBe("json");
    expect(
      readEnv({ ...baseEnv, LOG_FORMAT: "pretty", LOG_LEVEL: "debug" }),
    ).toMatchObject({ LOG_FORMAT: "pretty", LOG_LEVEL: "debug" });
  });

  it("accepts separately named Sign in with Apple and APNs credentials", () => {
    expect(
      readEnv({
        ...baseEnv,
        APPLE_SIGN_IN_CLIENT_ID: "com.example.splidly.signin",
        APPLE_SIGN_IN_KEY_ID: "SIGNINKEY",
        APPLE_SIGN_IN_PRIVATE_KEY_PATH: "/keys/sign-in.p8",
        APNS_ENVIRONMENT: "development",
        APNS_KEY_ID: "APNSKEY",
        APNS_PRIVATE_KEY_PATH: "/keys/apns.p8",
      }),
    ).toMatchObject({
      APPLE_SIGN_IN_KEY_ID: "SIGNINKEY",
      APNS_ENVIRONMENT: "development",
      APNS_KEY_ID: "APNSKEY",
    });
  });

  it("rejects a partially configured APNs credential set", () => {
    expect(() =>
      readEnv({
        ...baseEnv,
        APNS_ENVIRONMENT: "production",
      }),
    ).toThrow(/APNS_KEY_ID/);
  });

  it("rejects a partially configured Google credential set", () => {
    expect(() =>
      readEnv({
        ...baseEnv,
        GOOGLE_CLIENT_ID: "client-id",
      }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("rejects insecure URLs and placeholder secrets in production", () => {
    expect(() =>
      readEnv({
        ...baseEnv,
        NODE_ENV: "production",
        API_PUBLIC_URL: "http://api.example.com",
        BETTER_AUTH_SECRET: "replace-with-at-least-48-random-characters-value",
      }),
    ).toThrow(/must use HTTPS|high-entropy production secret/);
  });

  it("accepts a high-entropy HTTPS production configuration", () => {
    expect(
      readEnv({
        ...baseEnv,
        NODE_ENV: "production",
        BETTER_AUTH_SECRET:
          "2YQv9#jF7x!Lp4@cR8$wN6^mK3&zT5*eH1+uB0=sDgVaXqPi",
      }),
    ).toMatchObject({ NODE_ENV: "production" });
  });
});
