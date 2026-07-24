import { expo } from "@better-auth/expo";
import { authSchema, profiles, type Database } from "@splidly/db";
import {
  betterAuth,
  type BetterAuthOptions,
  type Session,
  type User,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAppleClientSecretFromFile } from "./apple-client-secret";
import type { Env } from "./env";

const demoEmail = "demo@local.splidly.invalid";

export interface Auth {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(input: {
      headers: Headers;
    }): Promise<{ session: Session; user: User } | null>;
  };
}

export async function createAuth(db: Database, env: Env): Promise<Auth> {
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
    env.APPLE_CLIENT_ID &&
    env.APPLE_KEY_ID &&
    env.APPLE_PRIVATE_KEY_PATH
  ) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: await createAppleClientSecretFromFile({
        clientId: env.APPLE_CLIENT_ID,
        keyId: env.APPLE_KEY_ID,
        privateKeyPath: env.APPLE_PRIVATE_KEY_PATH,
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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (
              env.NODE_ENV !== "development" ||
              user.email !== demoEmail
            ) {
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
          },
        },
      },
    },
    plugins: [expo()],
  };

  return betterAuth(options);
}
