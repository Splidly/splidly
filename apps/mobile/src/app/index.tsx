import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { ErrorState, LoadingState, Screen } from "../components/ui";
import { authClient } from "../lib/auth-client";
import { useConnectivity } from "../lib/connectivity";
import { friendlyErrorMessage } from "../lib/network";
import { profileNavigationState } from "../lib/profile-navigation";
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
  const profileState = profileNavigationState(profile);
  const startupError = session.error ?? profile.error;

  useEffect(() => {
    if (__DEV__ && startupError) {
      console.error("Splidly startup request failed", startupError);
    }
  }, [startupError]);

  useFocusEffect(
    useCallback(() => {
      if (session.isPending || session.error || !isOnline) return;
      if (!session.data?.user) {
        router.replace("/sign-in");
        return;
      }
      if (profileState === "pending" || profileState === "error") return;
      if (profileState === "onboarding") {
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
      profileState,
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
      {startupError ? (
        <ErrorState
          message={friendlyErrorMessage(startupError)}
          onRetry={() => {
            if (session.error) void session.refetch();
            if (profile.error) void profile.refetch();
          }}
        />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}
