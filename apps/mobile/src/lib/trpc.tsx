import type { AppRouter } from "@splidly/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState, type PropsWithChildren } from "react";
import superjson from "superjson";
import { authClient } from "./auth-client";
import { API_URL } from "./env";
import { friendlyFetch } from "./network";

export const api = createTRPCReact<AppRouter>();

export function ApiProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: 1 },
          mutations: { retry: 0 },
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
          headers() {
            const cookie = authClient.getCookie();
            return cookie ? { Cookie: cookie } : {};
          },
        }),
      ],
    }),
  );
  return (
    <api.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </api.Provider>
  );
}
