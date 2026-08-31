import { describe, expect, it, vi } from "vitest";
import { Logger } from "../src/logger";
import { revokeAppleProviderAccounts } from "../src/routers/profile";

const logger = new Logger({
  destination: { write() {} },
  level: "fatal",
});

describe("account deletion provider revocation", () => {
  it("decrypts and revokes an Apple refresh token", async () => {
    const decryptOAuthToken = vi.fn(async () => "plain-token");
    const revokeAppleToken = vi.fn(async () => {});

    await expect(
      revokeAppleProviderAccounts(
        [
          {
            providerId: "apple",
            accessToken: "encrypted-access",
            refreshToken: "encrypted-refresh",
          },
        ],
        { decryptOAuthToken, revokeAppleToken },
        logger,
      ),
    ).resolves.toBe(false);
    expect(decryptOAuthToken).toHaveBeenCalledWith("encrypted-refresh");
    expect(revokeAppleToken).toHaveBeenCalledWith({
      token: "plain-token",
      tokenType: "refresh_token",
    });
  });

  it("never blocks deletion when Apple is unavailable", async () => {
    await expect(
      revokeAppleProviderAccounts(
        [
          {
            providerId: "apple",
            accessToken: "encrypted-access",
            refreshToken: null,
          },
        ],
        {
          decryptOAuthToken: async () => "plain-token",
          revokeAppleToken: async () => {
            throw new Error("Apple unavailable");
          },
        },
        logger,
      ),
    ).resolves.toBe(true);
  });

  it("requests manual revocation when no revocable token exists", async () => {
    await expect(
      revokeAppleProviderAccounts(
        [
          {
            providerId: "apple",
            accessToken: null,
            refreshToken: null,
          },
        ],
        {
          decryptOAuthToken: async (token) => token,
          revokeAppleToken: async () => {},
        },
        logger,
      ),
    ).resolves.toBe(true);
  });
});
