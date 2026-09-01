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
  ANDROID_ENABLED: "true",
  ANDROID_PACKAGE: "com.example.splidly",
  ANDROID_SHA256_FINGERPRINT: "AA:BB",
  IOS_STORE_URL: "https://apps.apple.com/app/id123",
  ANDROID_STORE_URL: "https://play.google.com/store/apps/details?id=test",
};

const productionEnv = {
  ...baseEnv,
  NODE_ENV: "production",
  BETTER_AUTH_SECRET:
    "2YQv9#jF7x!Lp4@cR8$wN6^mK3&zT5*eH1+uB0=sDgVaXqPi",
  APPLE_SIGN_IN_CLIENT_ID: "site.splidly.signin",
  APPLE_SIGN_IN_KEY_ID: "SIGNINKEY1",
  APPLE_SIGN_IN_PRIVATE_KEY_PATH: "/keys/sign-in.p8",
  APNS_ENVIRONMENT: "production",
  APNS_KEY_ID: "APNSKEY001",
  APNS_PRIVATE_KEY_PATH: "/keys/apns.p8",
  GOOGLE_CLIENT_ID: "123-web.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  IOS_APP_ID: "site.splidly.app",
  IOS_TEAM_ID: "TEAM123456",
  ANDROID_ENABLED: "false",
  ANDROID_PACKAGE: "",
  ANDROID_SHA256_FINGERPRINT: "",
  IOS_STORE_URL: "https://apps.apple.com/app/splidly/id6795323135",
  ANDROID_STORE_URL: "",
  LEGAL_NAME: "Splidly Operator",
  LEGAL_STREET_ADDRESS: "Main Street 1",
  LEGAL_POSTAL_CODE: "10115",
  LEGAL_LOCALITY: "Berlin",
  LEGAL_COUNTRY: "Germany",
  LEGAL_EMAIL: "operator@splidly.site",
  LEGAL_PHONE: "+49 30 123456",
  PRIVACY_EMAIL: "privacy@splidly.site",
  ABUSE_EMAIL: "abuse@splidly.site",
  BACKUPS_ENABLED: "false",
  OFFSITE_BACKUP_PROVIDER: "",
  OFFSITE_BACKUP_COUNTRY: "",
  EDGE_LOG_RETENTION_DAYS: "0",
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
        ...productionEnv,
        API_PUBLIC_URL: "http://api.example.com",
        BETTER_AUTH_SECRET: "replace-with-at-least-48-random-characters-value",
      }),
    ).toThrow(/must use HTTPS|high-entropy production secret/);
  });

  it("accepts a high-entropy iOS-only production configuration", () => {
    expect(
      readEnv({
        ...productionEnv,
      }),
    ).toMatchObject({ ANDROID_ENABLED: false, NODE_ENV: "production" });
  });

  it("accepts a 32-byte Base64 production secret", () => {
    expect(
      readEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg=",
      }),
    ).toMatchObject({ NODE_ENV: "production" });
  });

  it("requires production providers and the iOS signing identity", () => {
    expect(() =>
      readEnv({
        ...productionEnv,
        GOOGLE_CLIENT_SECRET: "",
        APNS_ENVIRONMENT: "development",
      }),
    ).toThrow(/Google Sign-In|APNS_ENVIRONMENT/);
  });

  it("rejects missing or placeholder legal details in production", () => {
    expect(() =>
      readEnv({
        ...productionEnv,
        LEGAL_NAME: "replace-with-operator-name",
        LEGAL_PHONE: "",
      }),
    ).toThrow(/LEGAL_NAME|LEGAL_PHONE/);
  });

  it("requires final Android identity and store data when Android is enabled", () => {
    expect(() =>
      readEnv({
        ...productionEnv,
        ANDROID_ENABLED: "true",
        ANDROID_PACKAGE: "com.example.splidly",
        ANDROID_SHA256_FINGERPRINT: "AA:BB",
        ANDROID_STORE_URL:
          "https://play.google.com/store/apps/details?id=wrong",
      }),
    ).toThrow(/ANDROID_PACKAGE|ANDROID_SHA256_FINGERPRINT|ANDROID_STORE_URL/);
  });
});
