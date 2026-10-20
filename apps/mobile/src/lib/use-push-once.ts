import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useRef } from "react";

export function usePushOnce() {
  const pending = useRef(false);
  useFocusEffect(
    useCallback(() => {
      pending.current = false;
    }, []),
  );
  return (href: Href) => {
    if (pending.current) return;
    pending.current = true;
    router.push(href);
  };
}
