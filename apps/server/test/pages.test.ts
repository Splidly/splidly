import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { invitePage, privacyPage } from "../src/pages";

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

describe("privacy page", () => {
  it("describes collected data, retention, deletion, and contact", () => {
    const html = privacyPage();
    expect(html).toContain("Account and profile data");
    expect(html).toContain("Shared-ledger data");
    expect(html).toContain("IP address");
    expect(html).toContain("Service providers");
    expect(html).toContain("Retention and deletion");
    expect(html).toContain("privacy@splidly.site");
  });

  it("does not claim that data export exists in Settings", () => {
    expect(privacyPage()).not.toContain(
      "export or delete your account from Settings",
    );
  });
});
