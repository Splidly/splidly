import {
  Host,
  HStack,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundColor,
  frame,
  glassEffect,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme, useWindowDimensions, View } from "react-native";

export function AllocationFloatingSummary({
  title,
  progress,
  complete,
}: {
  title: string;
  progress: number;
  complete: boolean;
}) {
  const colorScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth - 32;
  const statusColor = complete
    ? colorScheme === "dark"
      ? "#55D6A0"
      : "#16845B"
    : colorScheme === "dark"
      ? "#FFB454"
      : "#A85D00";
  const accentColor = complete
    ? statusColor
    : colorScheme === "dark"
      ? "#7D7AFF"
      : "#5856D6";

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
        width,
        height: 76,
        overflow: "hidden",
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor:
          colorScheme === "dark"
            ? "rgba(44, 44, 46, 0.76)"
            : "rgba(255, 255, 255, 0.82)",
        boxShadow:
          colorScheme === "dark"
            ? "0 10px 28px rgba(0, 0, 0, 0.5)"
            : "0 10px 28px rgba(0, 0, 0, 0.18)",
      }}
    >
      <Host
        colorScheme={colorScheme === "dark" ? "dark" : "light"}
        style={{ width, height: 76 }}
      >
        <VStack
          spacing={9}
          modifiers={[
            padding({ horizontal: 16, vertical: 13 }),
            frame({ width, height: 76 }),
            glassEffect({
              glass: { variant: "regular" },
              shape: "roundedRectangle",
              cornerRadius: 24,
            }),
          ]}
        >
          <HStack alignment="center" spacing={12}>
            <Text
              modifiers={[
                font({ size: 15, weight: "bold" }),
                monospacedDigit(),
              ]}
            >
              {title}
            </Text>
            <Spacer />
            <Text
              modifiers={[
                font({ size: 13, weight: "bold" }),
                foregroundColor(statusColor),
              ]}
            >
              {complete ? "Complete" : "Incomplete"}
            </Text>
          </HStack>
          <ProgressView
            value={Math.max(0, Math.min(1, progress))}
            modifiers={[
              progressViewStyle("linear"),
              tint(accentColor),
            ]}
          />
        </VStack>
      </Host>
    </View>
  );
}
