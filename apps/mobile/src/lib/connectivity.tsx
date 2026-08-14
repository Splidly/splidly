import { onlineManager, type QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

type Connectivity = {
  isOnline: boolean;
  isResolved: boolean;
};

const ConnectivityContext = createContext<Connectivity>({
  isOnline: true,
  isResolved: false,
});

export function networkStateIsOnline(state: Network.NetworkState) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function ConnectivityProvider({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  const [connectivity, setConnectivity] = useState<Connectivity>({
    isOnline: true,
    isResolved: false,
  });
  const wasOnline = useRef(true);

  useEffect(() => {
    let active = true;
    const applyState = (state: Network.NetworkState) => {
      if (!active) return;
      const isOnline = networkStateIsOnline(state);
      onlineManager.setOnline(isOnline);
      setConnectivity({ isOnline, isResolved: true });
      if (isOnline && !wasOnline.current) {
        void queryClient.resumePausedMutations();
        void queryClient.refetchQueries({ type: "active" });
      }
      wasOnline.current = isOnline;
    };

    void Network.getNetworkStateAsync().then(applyState).catch(() => {
      // If the native reachability API itself is unavailable, fetch remains
      // the source of truth and its errors are still normalized centrally.
    });
    const subscription = Network.addNetworkStateListener(applyState);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [queryClient]);

  const value = useMemo(
    () => connectivity,
    [connectivity.isOnline, connectivity.isResolved],
  );
  return (
    <ConnectivityContext value={value}>{children}</ConnectivityContext>
  );
}

export function useConnectivity() {
  return use(ConnectivityContext);
}
