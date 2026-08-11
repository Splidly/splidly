import { resolvePublicUrl } from "./env";

describe("resolvePublicUrl", () => {
  it("normalizes whitespace and trailing slashes", () => {
    expect(
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        "  https://api.example.com/  ",
        "http://localhost:4000",
      ),
    ).toBe("https://api.example.com");
  });

  it("uses the fallback for missing or blank values", () => {
    expect(
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        "",
        "http://localhost:4000/",
      ),
    ).toBe("http://localhost:4000");
    expect(
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        undefined,
        "http://localhost:4000/",
      ),
    ).toBe("http://localhost:4000");
  });

  it("rejects URLs that native fetch cannot safely use as an API base", () => {
    expect(() =>
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        "/relative",
        "http://localhost:4000",
      ),
    ).toThrow("EXPO_PUBLIC_API_URL must be an absolute HTTP(S) URL");
    expect(() =>
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        "splidly://api",
        "http://localhost:4000",
      ),
    ).toThrow("EXPO_PUBLIC_API_URL must use http:// or https://");
    expect(() =>
      resolvePublicUrl(
        "EXPO_PUBLIC_API_URL",
        "https://api.example.com?environment=production",
        "http://localhost:4000",
      ),
    ).toThrow(
      "EXPO_PUBLIC_API_URL must not contain credentials, a query, or a hash",
    );
  });
});
