import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectivity } from "../lib/connectivity";
import { useTheme } from "../theme";

export function OfflineNotice() {
  const { isOnline, isResolved } = useConnectivity();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  if (!isResolved || isOnline) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 1_000,
        alignItems: "center",
      }}
    >
      <View
        style={{
          maxWidth: 420,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderCurve: "continuous",
          backgroundColor: theme.sheet,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: "0 5px 18px rgba(0, 0, 0, 0.18)",
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: theme.warning,
          }}
        />
        <View style={{ flexShrink: 1 }}>
          <Text
            selectable
            style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}
          >
            No Internet Connection
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 12 }}>
            Saved information remains available. Changes need a connection.
          </Text>
        </View>
      </View>
    </View>
  );
}
