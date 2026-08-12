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
import { ensureDemoData } from "./demo-data";
import type { Env } from "./env";
import type { Logger } from "./logger";

const demoEmail = "demo@local.splidly.invalid";

export interface Auth {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(input: {
      headers: Headers;
    }): Promise<{ session: Session; user: User } | null>;
  };
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
    socialProviders.apple = {
      clientId: env.APPLE_SIGN_IN_CLIENT_ID,
      clientSecret: await createAppleClientSecretFromFile({
        clientId: env.APPLE_SIGN_IN_CLIENT_ID,
        keyId: env.APPLE_SIGN_IN_KEY_ID,
        privateKeyPath: env.APPLE_SIGN_IN_PRIVATE_KEY_PATH,
        teamId: env.IOS_TEAM_ID,
      }),
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
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
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
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
      },
    },
    logger: {
      disableColors: true,
      level: env.LOG_LEVEL === "fatal" ? "error" : env.LOG_LEVEL,
      log(level, message, ...args) {
        logger[level]("auth.internal", {
          authMessage: message,
          ...(args.length > 0 ? { details: args } : {}),
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

  return betterAuth(options);
}
