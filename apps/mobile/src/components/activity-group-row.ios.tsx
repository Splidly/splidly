import {
  Button,
  HStack,
  Image,
  Text,
  VStack,
  ZStack,
  type ImageProps,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  aspectRatio,
  backgroundOverlay,
  clipShape,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  monospacedDigit,
  onGeometryChange,
  padding,
  resizable,
  shapes,
  textSelection,
  textCase,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { useColorScheme } from "react-native";
import {
  groupListBalanceLines,
  type GroupBalanceLine,
} from "../lib/group-balance-summary";
import { groupIconColorsFor } from "../lib/group-colors";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { useAvatarFile } from "./activity-avatar.ios";
import { groupIconImage, groupIconGlyphSize } from "./group-icon";
import type { ActivityGroupRowProps } from "./activity-group-row.types";

function BalanceLine({
  line,
  reservedWidth,
}: {
  line: GroupBalanceLine;
  reservedWidth: number;
}) {
  const theme = useTheme();
  return (
    <Text
      testID={`group-balance-${line.key}`}
      modifiers={[
        accessibilityLabel(line.text),
        font({ size: 13 }),
        foregroundStyle(theme.muted),
        monospacedDigit(),
        lineLimit(1),
        frame({ height: 17, alignment: "leading" }),
        padding({ trailing: reservedWidth }),
      ]}
    >
      {line.label}
      <Text
        modifiers={[
          font({ size: 13, weight: "semibold" }),
          foregroundStyle(
            line.tone === "negative" ? theme.negative : theme.positive,
          ),
        ]}
      >
        {" "}
        {line.amount}
      </Text>
    </Text>
  );
}

export function ActivityGroupRow(props: ActivityGroupRowProps) {
  const theme = useTheme();
  const file = useAvatarFile(props.imageUrl);
  const colors = groupIconColorsFor(
    props.color,
    props.id,
    useColorScheme() === "dark" ? "dark" : "light",
  );
  const [trailingWidth, setTrailingWidth] = useState(96);
  const icon = groupIconImage(props.iconKey);
  const lines = groupListBalanceLines(props.memberBalances);
  const visible = lines.length > 3 ? lines.slice(0, 2) : lines;
  const minor = BigInt(props.balance.minor);
  const settled = lines.length === 0 && minor === 0n;
  const status =
    minor < 0n
      ? "You owe"
      : minor > 0n
        ? "You are owed"
        : settled
          ? "Settled up"
          : "Net balance";
  const tone =
    minor < 0n ? theme.negative : minor > 0n ? theme.positive : theme.muted;
  const total = (
    <VStack
      alignment="trailing"
      spacing={2}
      testID={`group-total-${props.id}`}
      modifiers={[
        fixedSize({ horizontal: true, vertical: true }),
        ...(!settled
          ? [
              onGeometryChange(({ width }) => {
                if (width > 0)
                  setTrailingWidth((current) =>
                    current === width ? current : width,
                  );
              }),
            ]
          : []),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 10, weight: "semibold" }),
          kerning(0.35),
          textCase("uppercase"),
          foregroundStyle(tone),
          lineLimit(1),
          frame({ height: 14, alignment: "trailing" }),
        ]}
      >
        {status}
      </Text>
      {!settled ? (
        <Text
          modifiers={[
            font({ size: 14, weight: "bold" }),
            foregroundStyle(tone),
            monospacedDigit(),
            lineLimit(1),
            frame({ height: 18, alignment: "trailing" }),
          ]}
        >
          {formatMoney(minor < 0n ? -minor : minor, props.balance.currency)}
        </Text>
      ) : null}
    </VStack>
  );
  return (
    <Button
      onPress={props.onPress}
      testID={`activity-group-${props.id}`}
      modifiers={[textSelection(false)]}
    >
      <HStack
        spacing={12}
        alignment="top"
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 52, alignment: "leading" }),
          padding({ horizontal: 20, vertical: 12 }),
          contentShape(shapes.rectangle()),
        ]}
      >
        {file ? (
          <Image
            uiImage={file}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: "fill" }),
              frame({ width: 52, height: 52 }),
              clipShape("roundedRectangle", 15),
              accessibilityHidden(),
            ]}
          />
        ) : (
          <Image
            systemName={
              (typeof icon === "string"
                ? icon
                : "person.3.fill") as NonNullable<ImageProps["systemName"]>
            }
            size={groupIconGlyphSize(props.iconKey, 52)}
            color={colors.foreground}
            modifiers={[
              frame({ width: 52, height: 52 }),
              backgroundOverlay({ color: colors.background }),
              clipShape("roundedRectangle", 15),
              accessibilityHidden(),
            ]}
          />
        )}
        {settled ? (
          <HStack
            spacing={8}
            modifiers={[
              frame({
                maxWidth: Infinity,
                minHeight: 52,
                alignment: "leading",
              }),
            ]}
          >
            <Text
              modifiers={[
                font({ size: 19, weight: "bold" }),
                kerning(-0.3),
                foregroundStyle(theme.text),
                lineLimit(1),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {props.name}
            </Text>
            {total}
          </HStack>
        ) : (
          <ZStack
            alignment="topTrailing"
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <VStack
              alignment="leading"
              spacing={4}
              modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
            >
              <Text
                testID={`group-name-${props.id}`}
                modifiers={[
                  font({ size: 19, weight: "bold" }),
                  kerning(-0.3),
                  foregroundStyle(theme.text),
                  lineLimit(1),
                  frame({ height: 24, alignment: "leading" }),
                  padding({ trailing: trailingWidth + 8 }),
                ]}
              >
                {props.name}
              </Text>
              <VStack alignment="leading" spacing={3}>
                {visible.map((line, index) => (
                  <BalanceLine
                    key={line.key}
                    line={line}
                    reservedWidth={index === 0 ? trailingWidth + 8 : 0}
                  />
                ))}
                {lines.length > visible.length ? (
                  <Text
                    modifiers={[
                      font({ size: 13 }),
                      foregroundStyle(theme.muted),
                      frame({ height: 17, alignment: "leading" }),
                    ]}
                  >
                    {lines.length - visible.length} more not shown
                  </Text>
                ) : null}
              </VStack>
            </VStack>
            {total}
          </ZStack>
        )}
      </HStack>
    </Button>
  );
}
