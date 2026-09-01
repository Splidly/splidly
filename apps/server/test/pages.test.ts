import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import {
  deletionPage,
  invitePage,
  landingPage,
  legalPage,
  privacyPage,
  reportPage,
  termsPage,
} from "../src/pages";

const env = {
  APP_SCHEME: "splidly",
  ANDROID_ENABLED: true,
  IOS_STORE_URL: "https://apps.apple.com/example",
  ANDROID_STORE_URL: "https://play.google.com/example",
  LEGAL_NAME: "Example Operator",
  LEGAL_STREET_ADDRESS: "Example Street 1",
  LEGAL_POSTAL_CODE: "12345",
  LEGAL_LOCALITY: "Example City",
  LEGAL_COUNTRY: "Germany",
  LEGAL_EMAIL: "operator@example.com",
  LEGAL_PHONE: "+49 30 123456",
  PRIVACY_EMAIL: "privacy@example.com",
  ABUSE_EMAIL: "abuse@example.com",
  BACKUPS_ENABLED: false,
  OFFSITE_BACKUP_PROVIDER: "Operator-controlled encrypted device",
  OFFSITE_BACKUP_COUNTRY: "Germany",
  EDGE_LOG_RETENTION_DAYS: 0,
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
    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    );
    expect(html).not.toContain("play-mark");
    expect(html).toContain("https://splidly.site/og.png");
    expect(html).toContain("https://github.com/Splidly/splidly");
    expect(html).toContain('href="/legal"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/report"');
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
  it("uses the site favicon", () => {
    expect(privacyPage(env)).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    );
  });

  it("describes collected data, retention, deletion, and contact", () => {
    const html = privacyPage(env);
    expect(html).toContain("Account and profile data");
    expect(html).toContain("Shared-ledger data");
    expect(html).toContain("IP address");
    expect(html).toContain("Service providers");
    expect(html).toContain("Retention and deletion");
    expect(html).toContain("privacy@example.com");
    expect(html).toContain("Example Operator");
    expect(html).toContain("netcup GmbH");
    expect(html).toContain("does not currently create database or off-site backups");
    expect(html).not.toContain("Operator-controlled encrypted device");
    expect(html).toContain("raw edge logs are retained for up to 0 days");
    expect(html).toContain("Article 6(1)(b) GDPR");
    expect(html).toContain("supervisory authority");
  });

  it("does not claim that data export exists in Settings", () => {
    expect(privacyPage(env)).not.toContain(
      "export or delete your account from Settings",
    );
  });
});

describe("terms and abuse pages", () => {
  it("sets a minimum age and acceptable-use rules", () => {
    const html = termsPage(env);
    expect(html).toContain("at least 16 years old");
    expect(html).toContain("Acceptable use");
    expect(html).toContain("abuse@example.com");
    expect(html).toContain("does not hold or transfer money");
  });

  it("creates a contextual, escaped abuse report", () => {
    const html = reportPage(env, {
      type: "expense",
      id: `bad\"><script>alert(1)</script>`,
    });
    expect(html).toContain("abuse@example.com");
    expect(html).toContain("Content%20or%20user%20ID");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("legal notice", () => {
  it("publishes the configured operator and contact details", () => {
    const html = legalPage(env);
    expect(html).toContain("section 5 of the German Digital Services Act");
    expect(html).toContain("Example Operator");
    expect(html).toContain("Example Street 1");
    expect(html).toContain("operator@example.com");
    expect(html).toContain("+49 30 123456");
  });
});

describe("account deletion page", () => {
  it("embeds the server-issued CSRF token only in the signed-in form", () => {
    const html = deletionPage(true, undefined, "csrf-token");
    expect(html).toContain('name="csrfToken" value="csrf-token"');
    expect(html).toContain('name="confirmation"');
  });

  it("requires a CSRF token when rendering a destructive form", () => {
    expect(() => deletionPage(true)).toThrow("CSRF token");
  });
});
