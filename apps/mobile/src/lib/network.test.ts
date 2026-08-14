import {
  friendlyErrorMessage,
  friendlyFetch,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
} from "./network";

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

  it("recognizes platform and wrapped transport messages", () => {
    expect(isNetworkError("Network request failed")).toBe(true);
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(friendlyErrorMessage("The Internet connection appears to be offline"))
      .toBe(NETWORK_ERROR_MESSAGE);
  });

  it("hides backend implementation details", () => {
    expect(friendlyErrorMessage("DrizzleQueryError: Failed query: select *"))
      .toBe("Splidly couldn’t complete that request. Please try again.");
  });

  it("does not turn an intentional query cancellation into an offline error", async () => {
    const controller = new AbortController();
    controller.abort();
    const cause = new Error("Aborted");
    global.fetch = jest.fn().mockRejectedValue(cause);

    await expect(
      friendlyFetch("https://splidly.site/trpc", {
        signal: controller.signal,
      }),
    ).rejects.toBe(cause);
  });
});
