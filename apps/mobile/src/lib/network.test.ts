import {
  friendlyErrorMessage,
  friendlyFetch,
  isNetworkError,
  isServerUnavailableError,
  NETWORK_ERROR_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from "./network";

describe("friendlyFetch", () => {
  const originalFetch = global.fetch;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleError.mockRestore();
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
    expect(consoleError).toHaveBeenCalledWith(
      "Splidly network request failed",
      expect.objectContaining({
        cause,
        timedOut: false,
        upstreamAborted: false,
        url: "https://splidly.site/trpc",
      }),
    );
  });

  it("passes successful responses through unchanged", async () => {
    const response = new Response(null, { status: 204 });
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      friendlyFetch("https://splidly.site/health/ready"),
    ).resolves.toBe(response);
  });

  it("normalizes object headers for Expo's native fetch bridge", async () => {
    const response = new Response(null, { status: 204 });
    global.fetch = jest.fn().mockResolvedValue(response);

    await friendlyFetch("https://splidly.site/trpc/profile.me", {
      headers: { Cookie: "session=test", "x-client": "mobile" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://splidly.site/trpc/profile.me",
      expect.objectContaining({
        headers: [
          ["cookie", "session=test"],
          ["x-client", "mobile"],
        ],
      }),
    );
  });

  it("replaces an HTML gateway failure with a service availability error", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("<html><title>Bad gateway</title></html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(friendlyFetch("https://splidly.site/trpc")).rejects.toThrow(
      SERVER_UNAVAILABLE_MESSAGE,
    );
  });

  it("preserves structured API errors for the tRPC client", async () => {
    const response = new Response('{"error":"unauthorized"}', {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(friendlyFetch("https://splidly.site/trpc")).resolves.toBe(
      response,
    );
  });

  it("does not expose non-JSON response bodies", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("<html>Not found</html>", {
        status: 404,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(friendlyFetch("https://splidly.site/trpc")).rejects.toThrow(
      "Splidly couldn’t complete that request. Please try again.",
    );
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
    expect(friendlyErrorMessage("JSON Parse error: Unexpected character: <"))
      .toBe("Splidly couldn’t complete that request. Please try again.");
  });

  it("recognizes service availability errors separately from offline errors", () => {
    const error = new Error(SERVER_UNAVAILABLE_MESSAGE);
    expect(isServerUnavailableError(error)).toBe(true);
    expect(isNetworkError(error)).toBe(false);
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
    expect(consoleError).not.toHaveBeenCalled();
  });
});
