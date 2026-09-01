import { describe, expect, it } from "vitest";
import { isInviteActive } from "../src/routers/invites";

const now = new Date("2026-09-01T12:00:00.000Z");
const future = new Date("2026-09-08T12:00:00.000Z");

describe("invite availability", () => {
  it("keeps an accepted group invite active for additional people", () => {
    expect(
      isInviteActive(
        {
          kind: "group",
          expiresAt: future,
          usedAt: new Date("2026-09-01T11:00:00.000Z"),
          revokedAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("keeps friend invites single-use", () => {
    expect(
      isInviteActive(
        {
          kind: "friend",
          expiresAt: future,
          usedAt: new Date("2026-09-01T11:00:00.000Z"),
          revokedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects expired or revoked group invites", () => {
    expect(
      isInviteActive(
        {
          kind: "group",
          expiresAt: now,
          usedAt: null,
          revokedAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isInviteActive(
        {
          kind: "group",
          expiresAt: future,
          usedAt: null,
          revokedAt: now,
        },
        now,
      ),
    ).toBe(false);
  });
});
