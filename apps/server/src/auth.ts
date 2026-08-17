import { expo } from "@better-auth/expo";
import { authSchema, type Database, eq, profiles } from "@splidly/db";
import {
  betterAuth,
  type BetterAuthOptions,
  type Session,
  type User,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAppleClientSecretFromFile } from "./apple-client-secret";
import {
  revokeAppleToken,
  type AppleTokenType,
} from "./apple-token-revocation";
import { ensureDemoData } from "./demo-data";
import type { Env } from "./env";
import type { Logger } from "./logger";
import { decryptOAuthToken } from "./oauth-token-crypto";

const demoEmail = "demo@local.splidly.invalid";

export interface Auth {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(input: {
      headers: Headers;
    }): Promise<{ session: Session; user: User } | null>;
  };
  revokeAppleToken(input: {
    token: string;
    tokenType: AppleTokenType;
  }): Promise<void>;
  decryptOAuthToken(token: string): Promise<string>;
}

export async function createAuth(
  db: Database,
  env: Env,
  logger: Logger,
): Promise<Auth> {
  const socialProviders: Record<
    string,
    {
      clientId: string;
      clientSecret: string;
      appBundleIdentifier?: string;
    }
  > = {};
  let appleClientSecret: string | undefined;
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (
    env.APPLE_SIGN_IN_CLIENT_ID &&
    env.APPLE_SIGN_IN_KEY_ID &&
    env.APPLE_SIGN_IN_PRIVATE_KEY_PATH
  ) {
    appleClientSecret = await createAppleClientSecretFromFile({
      clientId: env.APPLE_SIGN_IN_CLIENT_ID,
      keyId: env.APPLE_SIGN_IN_KEY_ID,
      privateKeyPath: env.APPLE_SIGN_IN_PRIVATE_KEY_PATH,
      teamId: env.IOS_TEAM_ID,
    });
    socialProviders.apple = {
      clientId: env.APPLE_SIGN_IN_CLIENT_ID,
      clientSecret: appleClientSecret,
      appBundleIdentifier: env.IOS_APP_ID,
    };
  }

  const options: BetterAuthOptions = {
    appName: "Splidly",
    baseURL: env.API_PUBLIC_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      freshAge: 15 * 60,
    },
    emailAndPassword: { enabled: env.NODE_ENV === "development" },
    socialProviders,
    trustedOrigins: [
      env.APP_PUBLIC_URL,
      `${env.APP_SCHEME}://`,
      `${env.APP_SCHEME}://*`,
      ...(socialProviders.apple ? ["https://appleid.apple.com"] : []),
      ...(env.NODE_ENV === "development" ? ["exp://", "exp://**"] : []),
    ],
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
      },
    },
    verification: { storeIdentifier: "hashed" },
    rateLimit: {
      enabled: env.NODE_ENV === "production",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/*": { window: 60, max: 10 },
        "/sign-up/*": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      ipAddress: {
        ipAddressHeaders: ["x-real-ip"],
        ipv6Subnet: 64,
      },
    },
    logger: {
      disableColors: true,
      level: env.LOG_LEVEL === "fatal" ? "error" : env.LOG_LEVEL,
      log(level, message) {
        logger[level]("auth.internal", {
          authMessage: message,
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (env.NODE_ENV !== "development" || user.email !== demoEmail) {
              return;
            }
            await db
              .insert(profiles)
              .values({
                userId: user.id,
                displayName: "Demo User",
                homeCurrency: "EUR",
                onboardedAt: new Date(),
              })
              .onConflictDoNothing();
            logger.info("auth.demo-profile.ensured", { userId: user.id });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            if (env.NODE_ENV !== "development") return;
            const [user] = await db
              .select({ email: authSchema.user.email })
              .from(authSchema.user)
              .where(eq(authSchema.user.id, session.userId))
              .limit(1);
            if (user?.email !== demoEmail) return;
            await ensureDemoData(db, session.userId);
            logger.info("auth.demo-data.ensured", { userId: session.userId });
          },
        },
      },
    },
    plugins: [expo()],
  };

  logger.info("auth.configured", {
    emailAndPasswordEnabled: env.NODE_ENV === "development",
    providers: Object.keys(socialProviders),
  });

  const auth = betterAuth(options);
  return {
    ...auth,
    async decryptOAuthToken(token) {
      return decryptOAuthToken(token, env.BETTER_AUTH_SECRET);
    },
    async revokeAppleToken(input) {
      if (
        !env.APPLE_SIGN_IN_CLIENT_ID ||
        !env.APPLE_SIGN_IN_KEY_ID ||
        !env.APPLE_SIGN_IN_PRIVATE_KEY_PATH
      ) {
        throw new Error("Sign in with Apple is not configured");
      }
      const currentClientSecret = await createAppleClientSecretFromFile({
        clientId: env.APPLE_SIGN_IN_CLIENT_ID,
        keyId: env.APPLE_SIGN_IN_KEY_ID,
        privateKeyPath: env.APPLE_SIGN_IN_PRIVATE_KEY_PATH,
        teamId: env.IOS_TEAM_ID,
      });
      await revokeAppleToken({
        clientId: env.APPLE_SIGN_IN_CLIENT_ID,
        clientSecret: currentClientSecret,
        ...input,
      });
    },
  };
}
