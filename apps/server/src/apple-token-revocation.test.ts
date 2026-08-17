import { describe, expect, it, vi } from "vitest";
import { revokeAppleToken } from "./apple-token-revocation";

describe("revokeAppleToken", () => {
  it("posts the token to Apple's revocation endpoint", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await revokeAppleToken(
      {
        clientId: "com.example.splidly",
        clientSecret: "signed-client-secret",
        token: "private-refresh-token",
        tokenType: "refresh_token",
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toBe(
      "client_id=com.example.splidly&client_secret=signed-client-secret&token=private-refresh-token&token_type_hint=refresh_token",
    );
  });

  it("fails closed when Apple does not accept the revocation", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 400 }),
    );

    await expect(
      revokeAppleToken(
        {
          clientId: "client",
          clientSecret: "secret",
          token: "token",
          tokenType: "access_token",
        },
        fetchImpl,
      ),
    ).rejects.toThrow("Apple token revocation failed (400)");
  });
});
