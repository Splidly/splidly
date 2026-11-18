import type { PropsWithChildren } from "react";
import { View } from "react-native";

export function AndroidMenuTrigger({ children }: PropsWithChildren) {
  if (process.env.EXPO_OS !== "android") return <>{children}</>;

  // MenuView owns the gesture, including taps directly over a native Host.
  return (
    <View
      pointerEvents="none"
      style={{
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}
