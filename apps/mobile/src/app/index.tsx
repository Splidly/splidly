import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { LoadingState, Screen } from "../components/ui";
import { authClient } from "../lib/auth-client";
import { useConnectivity } from "../lib/connectivity";
import { api } from "../lib/trpc";

export default function IndexScreen() {
  const session = authClient.useSession();
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();
  const profile = api.profile.me.useQuery(undefined, {
    enabled: Boolean(session.data?.user),
  });
  const cancel = api.profile.deleteAccount.useMutation();
  const cancelling = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (session.isPending || session.error || !isOnline) return;
      if (!session.data?.user) {
        router.replace("/sign-in");
        return;
      }
      if (profile.isPending) return;
      if (!profile.data?.onboardedAt) {
        if (cancelling.current) return;
        cancelling.current = true;
        void cancel
          .mutateAsync({ confirmation: "DELETE" })
          .then(async () => {
            queryClient.clear();
            await authClient.signOut();
            router.replace("/sign-in");
          })
          .catch(() => {
            cancelling.current = false;
            router.push("/onboarding");
          });
        return;
      }
      router.replace("/(tabs)/friends");
    }, [
      profile.data?.onboardedAt,
      profile.isPending,
      cancel,
      queryClient,
      session.data?.user,
      session.error,
      session.isPending,
      isOnline,
    ]),
  );

  return (
    <Screen>
      <LoadingState />
    </Screen>
  );
}
