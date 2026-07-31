import { Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../theme";

/**
 * Generic fallback used by TypeScript and non-native renderers. Metro selects
 * the platform-specific iOS or Android implementation in a native build.
 */
export function AllocationFloatingSummary({
  title,
  progress,
  complete,
}: {
  title: string;
  progress: number;
  complete: boolean;
}) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const progressWidth =
    `${Math.max(0, Math.min(1, progress)) * 100}%` as const;

  return (
    <View
      testID="allocation-floating-summary"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${title}, ${
        complete ? "Complete" : "Incomplete"
      }`}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(Math.max(0, Math.min(1, progress)) * 100),
      }}
      style={{
        width: windowWidth - 32,
        height: 76,
        paddingHorizontal: 16,
        paddingVertical: 13,
        justifyContent: "center",
        gap: 9,
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: theme.text,
            flex: 1,
            fontSize: 15,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: complete ? theme.positive : theme.warning,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {complete ? "Complete" : "Incomplete"}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          overflow: "hidden",
          borderRadius: 3,
          backgroundColor: theme.elevated,
        }}
      >
        <View
          style={{
            width: progressWidth,
            height: "100%",
            borderRadius: 3,
            backgroundColor: complete ? theme.positive : theme.primary,
          }}
        />
      </View>
    </View>
  );
}
