import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { invitePage } from "../src/pages";

const env = {
  APP_SCHEME: "splidly",
  IOS_STORE_URL: "https://apps.apple.com/example",
  ANDROID_STORE_URL: "https://play.google.com/example",
} as Env;

describe("invite page", () => {
  it("links to the app and both stores", () => {
    const html = invitePage("safe_token", env);
    expect(html).toContain("splidly://invite/safe_token");
    expect(html).toContain(env.IOS_STORE_URL);
    expect(html).toContain(env.ANDROID_STORE_URL);
  });

  it("escapes untrusted token content", () => {
    const html = invitePage(`"><script>alert(1)</script>`, env);
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

