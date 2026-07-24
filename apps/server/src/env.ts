import { z } from "zod";

const optionalCredential = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const appleCredentialKeys = [
  "APPLE_CLIENT_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY_PATH",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    API_PUBLIC_URL: z.string().url(),
    APP_PUBLIC_URL: z.string().url(),
    APP_SCHEME: z.string().default("splidly"),
    APPLE_CLIENT_ID: optionalCredential,
    APPLE_KEY_ID: optionalCredential,
    APPLE_PRIVATE_KEY_PATH: optionalCredential,
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
      configuredCount === 0 ||
      configuredCount === appleCredentialKeys.length
    ) {
      return;
    }

    for (const key of appleCredentialKeys) {
      if (env[key]) continue;
      ctx.addIssue({
        code: "custom",
        message: `${key} is required when Sign in with Apple is configured`,
        path: [key],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
