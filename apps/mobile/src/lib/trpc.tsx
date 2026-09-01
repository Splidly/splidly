import type { AppRouter } from "@splidly/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState, type PropsWithChildren } from "react";
import superjson from "superjson";
import { authClient } from "./auth-client";
import { ConnectivityProvider } from "./connectivity";
import { API_URL } from "./env";
import {
  friendlyFetch,
  isNetworkError,
  isServerUnavailableError,
} from "./network";

export const api = createTRPCReact<AppRouter>();

export function ApiProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1_000,
            networkMode: "online",
            retry: (failureCount, error) =>
              (isNetworkError(error) || isServerUnavailableError(error)) &&
              failureCount < 1,
          },
          // A save made while offline must fail visibly and leave its sheet
          // open. It must not sit in React Query's paused mutation queue and
          // look as if it may already have been committed.
          mutations: { retry: 0, networkMode: "always" },
        },
      }),
  );
  const [client] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: `${API_URL}/trpc`,
          fetch: (input, init) =>
            friendlyFetch(input, init as RequestInit | undefined),
          async headers() {
            const cookie = await authClient.getCookie();
            return cookie ? { Cookie: cookie } : {};
          },
        }),
      ],
    }),
  );
  return (
    <api.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ConnectivityProvider queryClient={queryClient}>
          {children}
        </ConnectivityProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}
