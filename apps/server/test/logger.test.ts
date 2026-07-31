import type { Database } from "@splidly/db";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Auth } from "../src/auth";
import type { Env } from "../src/env";
import { Logger, withLogContext } from "../src/logger";

function captureLogger(level: "debug" | "info" = "debug") {
  const lines: string[] = [];
  const logger = new Logger({
    destination: { write: (line) => lines.push(line) },
    level,
  });
  return {
    lines,
    logger,
    entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe("structured logger", () => {
  it("writes JSON, preserves useful values, and serializes errors", () => {
    const capture = captureLogger();
    capture.logger.child({ requestId: "request-1" }).error("example.failed", {
      amount: 12n,
      error: new Error("broken"),
    });

    expect(capture.entries()).toEqual([
      expect.objectContaining({
        amount: "12",
        level: "error",
        message: "example.failed",
        requestId: "request-1",
        service: "splidly-server",
      }),
    ]);
    expect(capture.entries()[0]?.error).toEqual(
      expect.objectContaining({ message: "broken", name: "Error" }),
    );
  });

  it("redacts sensitive fields at every nesting level", () => {
    const capture = captureLogger();
    capture.logger.info("redaction", {
      accessToken: "token-value",
      password: "password-value",
      requestId: "request-1",
      tokenConfigured: true,
      nested: { clientSecret: "secret-value", safe: "visible" },
    });

    expect(capture.entries()[0]).toMatchObject({
      accessToken: "[REDACTED]",
      password: "[REDACTED]",
      requestId: "request-1",
      tokenConfigured: true,
      nested: { clientSecret: "[REDACTED]", safe: "visible" },
    });
  });

  it("filters messages below the configured level", () => {
    const capture = captureLogger("info");
    capture.logger.debug("hidden");
    capture.logger.info("visible");
    expect(capture.entries().map((entry) => entry.message)).toEqual(["visible"]);
  });

  it("propagates request context through asynchronous work", async () => {
    const capture = captureLogger();
    await withLogContext({ requestId: "request-async" }, async () => {
      await Promise.resolve();
      capture.logger.info("async.completed");
    });

    expect(capture.entries()[0]).toMatchObject({
      message: "async.completed",
      requestId: "request-async",
    });
  });
});

describe("HTTP observability", () => {
  const env = {
    APP_PUBLIC_URL: "https://app.example.com",
    IOS_TEAM_ID: "TEAM",
    IOS_APP_ID: "com.example.splidly",
    ANDROID_PACKAGE: "com.example.splidly",
    ANDROID_SHA256_FINGERPRINT: "AA:BB",
  } as Env;
  const auth = {
    handler: vi.fn(async () => new Response(null, { status: 204 })),
    api: { getSession: vi.fn(async () => null) },
  } as unknown as Auth;

  it("returns and logs the caller's safe request ID", async () => {
    const capture = captureLogger();
    const app = createApp({
      auth,
      db: {} as Database,
      env,
      logger: capture.logger,
    });
    const response = await app.request("/missing", {
      headers: { "x-request-id": "trace-123" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBe("trace-123");
    expect(capture.entries()).toContainEqual(
      expect.objectContaining({
        httpMethod: "GET",
        httpPath: "/missing",
        message: "http.request.completed",
        requestId: "trace-123",
        status: 404,
      }),
    );
  });

  it("logs unexpected failures with the same generated request ID", async () => {
    const capture = captureLogger();
    const db = {
      execute: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    } as unknown as Database;
    const app = createApp({ auth, db, env, logger: capture.logger });
    const response = await app.request("/health/ready");
    const body = (await response.json()) as { requestId: string };
    const entries = capture.entries();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        message: "http.request.unhandled",
        requestId: body.requestId,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        message: "http.request.completed",
        requestId: body.requestId,
        status: 500,
      }),
    );
  });
});
