import { z } from "zod";
import { logLevels } from "./logger";

const optionalCredential = z
  .string()
  .optional()
  .transform((value) => value || undefined);

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

const googleCredentialKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

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
    ANDROID_PACKAGE: z.string(),
    ANDROID_SHA256_FINGERPRINT: z.string(),
    IOS_STORE_URL: z.string().url(),
    ANDROID_STORE_URL: z.string().url(),
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
      env.BETTER_AUTH_SECRET.length < 48 ||
      looksLikePlaceholder(env.BETTER_AUTH_SECRET) ||
      new Set(env.BETTER_AUTH_SECRET).size < 12
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "BETTER_AUTH_SECRET must be a high-entropy production secret of at least 48 characters",
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
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
