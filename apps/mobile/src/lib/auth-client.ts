import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import { API_URL } from "./env";
import { friendlyFetch } from "./network";

const client = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { customFetchImpl: friendlyFetch },
  plugins: [
    expoClient({
      scheme: "splidly",
      storagePrefix: "splidly",
      storage: SecureStore,
    }) as never,
  ],
});

const demoCredentials = {
  email: "demo@local.splidly.invalid",
  password: "splidly-local-demo-account",
} as const;

type DemoAuthResponse = {
  token: string | null;
  user: { id: string; name: string };
};

function demoAuthRequest(
  path: "/sign-in/email" | "/sign-up/email",
  body: Record<string, string>,
) {
  return client.$fetch<DemoAuthResponse>(path, {
    method: "POST",
    body,
  });
}

export async function signInAsDemo() {
  const signIn = await demoAuthRequest("/sign-in/email", demoCredentials);
  if (!signIn.error) return;

  const signUp = await demoAuthRequest("/sign-up/email", {
    ...demoCredentials,
    name: "Demo User",
  });
  if (!signUp.error) return;

  // If two clients created the shared account concurrently, retry sign-in.
  const retry = await demoAuthRequest("/sign-in/email", demoCredentials);
  if (retry.error) {
    throw new Error(retry.error.message || "Demo sign-in failed");
  }
}

export const authClient = client as typeof client & {
  getCookie(): Promise<string>;
};
