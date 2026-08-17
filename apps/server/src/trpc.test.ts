import { describe, expect, it } from "vitest";
import { isRecentSession, recentSessionMaxAgeMs } from "./trpc";

describe("isRecentSession", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("accepts a session created within the deletion window", () => {
    expect(isRecentSession(new Date(now.getTime() - 60_000), now)).toBe(true);
  });

  it("rejects stale and future-dated sessions", () => {
    expect(
      isRecentSession(new Date(now.getTime() - recentSessionMaxAgeMs), now),
    ).toBe(false);
    expect(isRecentSession(new Date(now.getTime() + 1), now)).toBe(false);
  });
});
