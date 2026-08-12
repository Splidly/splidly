import { friendlyFetch, NETWORK_ERROR_MESSAGE } from "./network";

describe("friendlyFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("replaces native transport details with an actionable message", async () => {
    const cause = new Error(
      "fetch failed: UnexpectedException: Ungültige URL (at ExpoModulesCore/Promise.swift:56)",
    );
    global.fetch = jest.fn().mockRejectedValue(cause);

    await expect(friendlyFetch("https://splidly.site/trpc")).rejects.toMatchObject(
      {
        message: NETWORK_ERROR_MESSAGE,
        cause,
      },
    );
  });

  it("passes successful responses through unchanged", async () => {
    const response = new Response(null, { status: 204 });
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      friendlyFetch("https://splidly.site/health/ready"),
    ).resolves.toBe(response);
  });
});
