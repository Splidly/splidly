import {
  Button,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  type ImageProps,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  backgroundOverlay,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  padding,
  shapes,
  textCase,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { expenseIconPresentation } from "./expense-icon";
import { expenseInvolvementPresentation } from "./expense-list-involvement";
import type { ActivityExpenseRowProps } from "./activity-expense-row.types";

// The label stays entirely in SwiftUI. Hosting a Yoga-sized RN Pressable here
// clips its moving content and introduces a separate rectangular press highlight.
export function ActivityExpenseRow(props: ActivityExpenseRowProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { option, colors } = expenseIconPresentation(
    props.iconKey,
    props.title,
    props.useNameFallback,
    scheme,
  );
  const involvement = props.involvement
    ? expenseInvolvementPresentation(props.involvement.kind, theme)
    : undefined;
  return (
    <Button
      onPress={props.onPress}
      testID={`activity-expense-${props.title}`}
      modifiers={[textSelection(false)]}
    >
      <HStack
        spacing={12}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 40, alignment: "leading" }),
          padding({ horizontal: 16, vertical: 10 }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Image
          systemName={option.image as NonNullable<ImageProps["systemName"]>}
          size={20}
          color={colors.foreground}
          modifiers={[
            frame({ width: 40, height: 40 }),
            backgroundOverlay({ color: colors.background }),
            clipShape("roundedRectangle", 11),
            accessibilityHidden(),
          ]}
        />
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: "body" }),
              foregroundStyle(theme.text),
              lineLimit(1),
            ]}
          >
            {props.title}
          </Text>
          {props.subtitle ? (
            <Text
              modifiers={[
                font({ size: 13, textStyle: "footnote" }),
                foregroundStyle(theme.muted),
                lineLimit(1),
              ]}
            >
              {props.subtitle}
            </Text>
          ) : null}
        </VStack>
        <Spacer minLength={0} />
        {props.involvement && involvement ? (
          <VStack
            alignment="trailing"
            spacing={1}
            modifiers={[layoutPriority(1)]}
          >
            <Text
              modifiers={[
                font({ size: 10, textStyle: "caption2", weight: "bold" }),
                foregroundStyle(involvement.color),
                textCase("uppercase"),
                lineLimit(1),
              ]}
            >
              {involvement.label}
            </Text>
            {props.involvement.kind !== "none" ? (
              <Text
                modifiers={[
                  font({ size: 15, textStyle: "subheadline", weight: "bold" }),
                  foregroundStyle(involvement.color),
                  monospacedDigit(),
                  lineLimit(1),
                ]}
              >
                {formatMoney(
                  props.involvement.amount.minor,
                  props.involvement.amount.currency,
                )}
              </Text>
            ) : null}
          </VStack>
        ) : props.value ? (
          <HStack spacing={8} modifiers={[layoutPriority(1)]}>
            <Text
              modifiers={[
                font({
                  size: 15,
                  textStyle: "subheadline",
                  weight: "semibold",
                }),
                foregroundStyle(theme.text),
                monospacedDigit(),
                lineLimit(1),
              ]}
            >
              {props.value}
            </Text>
            <Image
              systemName="chevron.right"
              size={12}
              color={theme.muted}
              modifiers={[accessibilityHidden()]}
            />
          </HStack>
        ) : null}
      </HStack>
    </Button>
  );
}
