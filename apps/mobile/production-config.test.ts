import { describe, expect, it } from "@jest/globals";
import { resolveMobileBuildConfig } from "./production-config";

const productionEnv = {
  APP_ENV: "production",
  EXPO_PUBLIC_API_URL: "https://api.splidly.site",
  EXPO_PUBLIC_APP_URL: "https://splidly.site",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
    "123-web.apps.googleusercontent.com",
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
    "123-ios.apps.googleusercontent.com",
  GOOGLE_IOS_REVERSED_CLIENT_ID: "com.googleusercontent.apps.123-ios",
  IOS_APP_ID: "site.splidly.app",
  ANDROID_ENABLED: "false",
};

describe("production mobile configuration", () => {
  it("accepts an iOS-only production release", () => {
    expect(resolveMobileBuildConfig(productionEnv)).toMatchObject({
      androidEnabled: false,
      apiUrl: "https://api.splidly.site",
      appUrl: "https://splidly.site",
      iosBundleIdentifier: "site.splidly.app",
      production: true,
    });
  });

  it("fails closed when production values are missing or placeholders", () => {
    expect(() =>
      resolveMobileBuildConfig({
        ...productionEnv,
        EXPO_PUBLIC_API_URL: "http://localhost:4000",
      }),
    ).toThrow(/final public HTTPS URL/);
  });

  it("blocks Android production builds until Android is enabled", () => {
    expect(() =>
      resolveMobileBuildConfig({
        ...productionEnv,
        EAS_BUILD_PLATFORM: "android",
      }),
    ).toThrow(/Android production builds are disabled/);
  });

  it("requires a final package when Android is enabled", () => {
    expect(() =>
      resolveMobileBuildConfig({
        ...productionEnv,
        ANDROID_ENABLED: "true",
        ANDROID_PACKAGE: "com.example.splidly",
      }),
    ).toThrow(/final reverse-DNS identifier/);
  });

  it("rejects a mismatched reversed Google iOS client ID", () => {
    expect(() =>
      resolveMobileBuildConfig({
        ...productionEnv,
        GOOGLE_IOS_REVERSED_CLIENT_ID:
          "com.googleusercontent.apps.different-client",
      }),
    ).toThrow(/must match EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/);
  });

  it("retains safe local-development defaults", () => {
    expect(resolveMobileBuildConfig({})).toMatchObject({
      apiUrl: "http://localhost:4000",
      production: false,
    });
  });
});
