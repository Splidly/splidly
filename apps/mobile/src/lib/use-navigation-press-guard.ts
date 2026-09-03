import { useCallback, useRef } from "react";

const DEFAULT_GUARD_INTERVAL_MS = 750;

export function useNavigationPressGuard(
  intervalMs = DEFAULT_GUARD_INTERVAL_MS,
) {
  const lastAcceptedPressRef = useRef<number | undefined>(undefined);

  return useCallback(() => {
    const now = Date.now();
    const lastAcceptedPress = lastAcceptedPressRef.current;
    if (
      lastAcceptedPress !== undefined &&
      now - lastAcceptedPress < intervalMs
    ) {
      return false;
    }

    lastAcceptedPressRef.current = now;
    return true;
  }, [intervalMs]);
}
