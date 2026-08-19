import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { invitePage, landingPage, privacyPage } from "../src/pages";

const env = {
  APP_SCHEME: "splidly",
  ANDROID_ENABLED: true,
  IOS_STORE_URL: "https://apps.apple.com/example",
  ANDROID_STORE_URL: "https://play.google.com/example",
} as Env;

const iosOnlyEnv = {
  ...env,
  ANDROID_ENABLED: false,
  ANDROID_PACKAGE: undefined,
  ANDROID_STORE_URL: undefined,
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

  it("offers only the iOS app while Android is deferred", () => {
    const html = invitePage("safe_token", iosOnlyEnv);
    expect(html).toContain("Install for iPhone or iPad");
    expect(html).not.toContain("Install for Android");
  });
});

describe("landing page", () => {
  it("presents the product and links to both app stores", () => {
    const html = landingPage(env);
    expect(html).toContain("Split the cost.");
    expect(html).toContain("How it works");
    expect(html).toContain("Open source");
    expect(html).not.toContain("No awkward spreadsheets");
    expect(html).toContain("Lisbon Weekend");
    expect(html).toContain('src="/app-group-overview.png"');
    expect(html).toContain('src="/app-statistics.png"');
    expect(html).not.toContain("Dinner at Prado");
    expect(html).toContain(env.IOS_STORE_URL);
    expect(html).toContain(env.ANDROID_STORE_URL);
    expect(html).toContain('src="/app-store-badge.svg"');
    expect(html).toContain('src="/google-play-badge.png"');
    expect(html).not.toContain("play-mark");
    expect(html).toContain("https://splidly.site/og.png");
    expect(html).toContain("https://github.com/Splidly/splidly");
    expect(html).toContain("Florian2807");
    expect(html).toContain("LosFarmosCTL");
    expect(html.indexOf('id="open-source"')).toBeLessThan(
      html.indexOf('id="how-it-works"'),
    );
    expect(html.indexOf('href="#open-source"')).toBeLessThan(
      html.indexOf('href="#how-it-works"'),
    );
  });

  it("keeps normal browser text selection enabled", () => {
    expect(landingPage(env)).not.toContain("user-select: none");
  });

  it("advertises iPhone and iPad without an unreleased Android badge", () => {
    const html = landingPage(iosOnlyEnv);
    expect(html).toContain("Built for iPhone &amp; iPad");
    expect(html).not.toContain('src="/google-play-badge.png"');
    expect(html).not.toContain("Get Splidly on Google Play");
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
