import type { Database } from "@splidly/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Auth } from "../src/auth";
import type { Env } from "../src/env";
import { Logger } from "../src/logger";

const env = {
  NODE_ENV: "test",
  APP_PUBLIC_URL: "https://splidly.example.com",
  APP_SCHEME: "splidly",
  IOS_APP_ID: "com.example.splidly",
  IOS_TEAM_ID: "TEAM123",
  ANDROID_ENABLED: false,
  ANDROID_PACKAGE: "com.example.splidly",
  ANDROID_SHA256_FINGERPRINT: "AA:BB",
  IOS_STORE_URL: "https://apps.apple.com/example",
  ANDROID_STORE_URL: "https://play.google.com/example",
} as Env;

const auth = {
  handler: async () => new Response(null, { status: 404 }),
  api: { getSession: async () => null },
  decryptOAuthToken: async (token: string) => token,
  revokeAppleToken: async () => {},
} as Auth;

function testApp(nodeEnv: Env["NODE_ENV"] = "test") {
  return createApp({
    auth,
    db: {} as Database,
    env: { ...env, NODE_ENV: nodeEnv },
    logger: new Logger({
      destination: { write() {} },
      level: "fatal",
    }),
  });
}

describe("HTTP security boundary", () => {
  it("sets defensive browser headers and a nonce on inline scripts", async () => {
    const response = await testApp().request("/account/delete");
    const html = await response.text();
    const policy = response.headers.get("content-security-policy") ?? "";
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(nonce).toBeTruthy();
    expect(html).toContain(`script nonce="${nonce}"`);
  });

  it("enables HSTS only for the production HTTPS deployment", async () => {
    const development = await testApp().request("/");
    const production = await testApp("production").request("/");

    expect(development.headers.has("strict-transport-security")).toBe(false);
    expect(production.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("serves the site favicon as an SVG image", async () => {
    const response = await testApp().request("/favicon.svg");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400",
    );
    expect(await response.text()).toContain("<svg");
  });

  it("rejects oversized private API requests", async () => {
    const response = await testApp().request("/trpc/example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(1_000_001),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Request body is too large",
    });
  });

  it("rejects account deletion posts without a matching CSRF token", async () => {
    const response = await testApp().request("/account/delete", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: env.APP_PUBLIC_URL,
      },
      body: "confirmation=DELETE",
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Invalid security token");
  });

  it("publishes no Android association while Android is unreleased", async () => {
    const response = await testApp().request("/.well-known/assetlinks.json");
    await expect(response.json()).resolves.toEqual([]);
  });
});
