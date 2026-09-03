import { z } from "zod";
import { logLevels } from "./logger";

const optionalCredential = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const environmentBoolean = z.preprocess(
  (value) => {
    if (value === undefined || value === "") return false;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  },
  z.boolean(),
);

const appleCredentialKeys = [
  "APPLE_SIGN_IN_CLIENT_ID",
  "APPLE_SIGN_IN_KEY_ID",
  "APPLE_SIGN_IN_PRIVATE_KEY_PATH",
] as const;

const apnsCredentialKeys = [
  "APNS_ENVIRONMENT",
  "APNS_KEY_ID",
  "APNS_PRIVATE_KEY_PATH",
] as const;

const googleCredentialKeys = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

const reverseDnsIdentifier = /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9][a-zA-Z0-9_-]*)+$/;
const androidFingerprint = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;

function looksLikePlaceholder(value: string) {
  return /replace|changeme|example|placeholder/i.test(value);
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
    LOG_LEVEL: z.enum(logLevels).default("info"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    API_PUBLIC_URL: z.string().url(),
    APP_PUBLIC_URL: z.string().url(),
    APP_SCHEME: z
      .string()
      .regex(/^[a-z][a-z0-9+.-]*$/, "Use a valid lowercase URL scheme")
      .default("splidly"),
    APPLE_SIGN_IN_CLIENT_ID: optionalCredential,
    APPLE_SIGN_IN_KEY_ID: optionalCredential,
    APPLE_SIGN_IN_PRIVATE_KEY_PATH: optionalCredential,
    APNS_ENVIRONMENT: z.preprocess(
      (value) => value || undefined,
      z.enum(["development", "production"]).optional(),
    ),
    APNS_KEY_ID: optionalCredential,
    APNS_PRIVATE_KEY_PATH: optionalCredential,
    GOOGLE_CLIENT_ID: optionalCredential,
    GOOGLE_CLIENT_SECRET: optionalCredential,
    FRANKFURTER_URL: z.string().url(),
    IOS_APP_ID: z.string(),
    IOS_TEAM_ID: z.string(),
    ANDROID_ENABLED: environmentBoolean.default(false),
    ANDROID_PACKAGE: optionalCredential,
    ANDROID_SHA256_FINGERPRINT: optionalCredential,
    IOS_STORE_URL: z.string().url(),
    ANDROID_STORE_URL: z.preprocess(
      (value) => value || undefined,
      z.string().url().optional(),
    ),
    LEGAL_NAME: optionalCredential,
    LEGAL_STREET_ADDRESS: optionalCredential,
    LEGAL_POSTAL_CODE: optionalCredential,
    LEGAL_LOCALITY: optionalCredential,
    LEGAL_COUNTRY: optionalCredential,
    LEGAL_EMAIL: z.preprocess(
      (value) => value || undefined,
      z.email().optional(),
    ),
    PRIVACY_EMAIL: z.preprocess(
      (value) => value || undefined,
      z.email().optional(),
    ),
    ABUSE_EMAIL: z.preprocess(
      (value) => value || undefined,
      z.email().optional(),
    ),
    BACKUPS_ENABLED: environmentBoolean.default(false),
    EDGE_LOG_RETENTION_DAYS: z.preprocess(
      (value) => value === "" || value === undefined ? undefined : value,
      z.coerce.number().int().min(0).max(30).optional(),
    ),
    LEGAL_PHONE: optionalCredential,
    LEGAL_REPRESENTATIVE: optionalCredential,
    LEGAL_REGISTRY_NAME: optionalCredential,
    LEGAL_REGISTRY_NUMBER: optionalCredential,
    LEGAL_VAT_ID: optionalCredential,
  })
  .superRefine((env, ctx) => {
    const configuredCount = appleCredentialKeys.filter(
      (key) => env[key],
    ).length;
    if (
      configuredCount !== 0 &&
      configuredCount !== appleCredentialKeys.length
    ) {
      for (const key of appleCredentialKeys) {
        if (env[key]) continue;
        ctx.addIssue({
          code: "custom",
          message: `${key} is required when Sign in with Apple is configured`,
          path: [key],
        });
      }
    }
    const apnsConfiguredCount = apnsCredentialKeys.filter(
      (key) => env[key],
    ).length;
    if (
      apnsConfiguredCount !== 0 &&
      apnsConfiguredCount !== apnsCredentialKeys.length
    ) {
      for (const key of apnsCredentialKeys) {
        if (env[key]) continue;
        ctx.addIssue({
          code: "custom",
          message: `${key} is required when APNs delivery is configured`,
          path: [key],
        });
      }
    }
    const googleConfiguredCount = googleCredentialKeys.filter(
      (key) => env[key],
    ).length;
    if (
      googleConfiguredCount !== 0 &&
      googleConfiguredCount !== googleCredentialKeys.length
    ) {
      for (const key of googleCredentialKeys) {
        if (env[key]) continue;
        ctx.addIssue({
          code: "custom",
          message: `${key} is required when Google Sign-In is configured`,
          path: [key],
        });
      }
    }
    if (env.NODE_ENV !== "production") return;

    for (const key of [
      "LEGAL_NAME",
      "LEGAL_STREET_ADDRESS",
      "LEGAL_POSTAL_CODE",
      "LEGAL_LOCALITY",
      "LEGAL_COUNTRY",
      "LEGAL_EMAIL",
      "PRIVACY_EMAIL",
      "ABUSE_EMAIL",
    ] as const) {
      if (!env[key] || looksLikePlaceholder(env[key])) {
        ctx.addIssue({
          code: "custom",
          message: `${key} must contain the operator's final public legal details in production`,
          path: [key],
        });
      }
    }
    if (env.EDGE_LOG_RETENTION_DAYS === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "EDGE_LOG_RETENTION_DAYS must be set to the actual retention from 0 to 30 in production",
        path: ["EDGE_LOG_RETENTION_DAYS"],
      });
    }
    if (Boolean(env.LEGAL_REGISTRY_NAME) !== Boolean(env.LEGAL_REGISTRY_NUMBER)) {
      ctx.addIssue({
        code: "custom",
        message:
          "LEGAL_REGISTRY_NAME and LEGAL_REGISTRY_NUMBER must be configured together",
        path: ["LEGAL_REGISTRY_NAME"],
      });
    }

    for (const [label, keys] of [
      ["Sign in with Apple", appleCredentialKeys],
      ["APNs", apnsCredentialKeys],
      ["Google Sign-In", googleCredentialKeys],
    ] as const) {
      for (const key of keys) {
        if (env[key]) continue;
        ctx.addIssue({
          code: "custom",
          message: `${key} is required for ${label} in production`,
          path: [key],
        });
      }
    }
    if (env.APNS_ENVIRONMENT !== "production") {
      ctx.addIssue({
        code: "custom",
        message: "APNS_ENVIRONMENT must be production in production",
        path: ["APNS_ENVIRONMENT"],
      });
    }
    if (env.LOG_FORMAT !== "json") {
      ctx.addIssue({
        code: "custom",
        message: "LOG_FORMAT must be json in production",
        path: ["LOG_FORMAT"],
      });
    }
    for (const key of ["API_PUBLIC_URL", "APP_PUBLIC_URL"] as const) {
      if (new URL(env[key]).protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          message: `${key} must use HTTPS in production`,
          path: [key],
        });
      }
    }
    if (
      env.BETTER_AUTH_SECRET.length < 43 ||
      looksLikePlaceholder(env.BETTER_AUTH_SECRET) ||
      new Set(env.BETTER_AUTH_SECRET).size < 12
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "BETTER_AUTH_SECRET must be a high-entropy production secret of at least 43 characters",
        path: ["BETTER_AUTH_SECRET"],
      });
    }
    for (const key of [
      "APPLE_SIGN_IN_PRIVATE_KEY_PATH",
      "APNS_PRIVATE_KEY_PATH",
    ] as const) {
      const value = env[key];
      if (value && !value.startsWith("/")) {
        ctx.addIssue({
          code: "custom",
          message: `${key} must be an absolute path in production`,
          path: [key],
        });
      }
    }
    for (const key of ["IOS_APP_ID"] as const) {
      if (
        !reverseDnsIdentifier.test(env[key]) ||
        looksLikePlaceholder(env[key])
      ) {
        ctx.addIssue({
          code: "custom",
          message: `${key} must be a final reverse-DNS identifier in production`,
          path: [key],
        });
      }
    }
    if (env.ANDROID_ENABLED) {
      if (
        !env.ANDROID_PACKAGE ||
        !reverseDnsIdentifier.test(env.ANDROID_PACKAGE) ||
        looksLikePlaceholder(env.ANDROID_PACKAGE)
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "ANDROID_PACKAGE must be a final reverse-DNS identifier when Android is enabled",
          path: ["ANDROID_PACKAGE"],
        });
      }
      if (!env.ANDROID_STORE_URL) {
        ctx.addIssue({
          code: "custom",
          message: "ANDROID_STORE_URL is required when Android is enabled",
          path: ["ANDROID_STORE_URL"],
        });
      }
    }
    if (!/^[A-Z0-9]{10}$/.test(env.IOS_TEAM_ID)) {
      ctx.addIssue({
        code: "custom",
        message: "IOS_TEAM_ID must be a 10-character Apple Team ID",
        path: ["IOS_TEAM_ID"],
      });
    }
    for (const key of ["APPLE_SIGN_IN_KEY_ID", "APNS_KEY_ID"] as const) {
      if (!/^[A-Z0-9]{10}$/.test(env[key] ?? "")) {
        ctx.addIssue({
          code: "custom",
          message: `${key} must be a 10-character Apple key ID`,
          path: [key],
        });
      }
    }
    if (
      !reverseDnsIdentifier.test(env.APPLE_SIGN_IN_CLIENT_ID ?? "") ||
      looksLikePlaceholder(env.APPLE_SIGN_IN_CLIENT_ID ?? "")
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "APPLE_SIGN_IN_CLIENT_ID must be the final Apple Services ID",
        path: ["APPLE_SIGN_IN_CLIENT_ID"],
      });
    }
    if (
      !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(
        env.GOOGLE_CLIENT_ID ?? "",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "GOOGLE_CLIENT_ID must be the Google web OAuth client ID",
        path: ["GOOGLE_CLIENT_ID"],
      });
    }
    const fingerprints = (env.ANDROID_SHA256_FINGERPRINT ?? "").split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      env.ANDROID_ENABLED &&
      (fingerprints.length === 0 ||
        fingerprints.some((value) => !androidFingerprint.test(value)))
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "ANDROID_SHA256_FINGERPRINT must contain comma-separated SHA-256 certificate fingerprints",
        path: ["ANDROID_SHA256_FINGERPRINT"],
      });
    }
    const iosStoreUrl = new URL(env.IOS_STORE_URL);
    if (
      iosStoreUrl.hostname !== "apps.apple.com" ||
      !/\/id\d+(?:\/|$)/.test(iosStoreUrl.pathname)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "IOS_STORE_URL must be the final apps.apple.com app URL",
        path: ["IOS_STORE_URL"],
      });
    }
    if (env.ANDROID_ENABLED && env.ANDROID_STORE_URL) {
      const androidStoreUrl = new URL(env.ANDROID_STORE_URL);
      if (
        androidStoreUrl.hostname !== "play.google.com" ||
        androidStoreUrl.pathname !== "/store/apps/details" ||
        androidStoreUrl.searchParams.get("id") !== env.ANDROID_PACKAGE
      ) {
        ctx.addIssue({
          code: "custom",
          message: "ANDROID_STORE_URL must match ANDROID_PACKAGE",
          path: ["ANDROID_STORE_URL"],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
