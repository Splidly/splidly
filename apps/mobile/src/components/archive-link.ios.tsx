import { Button, Host, HStack, Image, Spacer, Text } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { spacing, useTheme } from "../theme";
import type { ArchiveLinkProps } from "./archive-link.types";

export function ArchiveLink({ label, count, onPress, icon = "archive" }: ArchiveLinkProps) {
  const theme = useTheme();
  return (
    <Host
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      style={{ alignSelf: "stretch", marginTop: spacing.sm, marginHorizontal: spacing.sm }}
    >
      <Button
        testID="archive-link"
        onPress={onPress}
        modifiers={[
          buttonStyle("plain"),
          textSelection(false),
          accessibilityLabel(count === undefined ? label : `${label}, ${count}`),
        ]}
      >
        <HStack
          testID="archive-link-content"
          alignment="center"
          spacing={spacing.sm}
          modifiers={[
            padding({ horizontal: spacing.sm, vertical: spacing.sm }),
            frame({ maxWidth: Infinity, minHeight: 52, alignment: "leading" }),
            contentShape(shapes.rectangle()),
            font({ size: 14, weight: "medium" }),
            foregroundStyle(theme.muted),
          ]}
        >
          <Image
            systemName={icon === "settled" ? "checkmark.circle" : "archivebox"}
            size={20}
            color={theme.muted}
            modifiers={[frame({ width: 24, height: 24 }), accessibilityHidden()]}
          />
          <Text>{label}</Text>
          <Spacer minLength={0} />
          {count !== undefined ? (
            <Text modifiers={[monospacedDigit()]}>{String(count)}</Text>
          ) : null}
          <Image
            systemName="chevron.right"
            size={12}
            color={theme.subtle}
            modifiers={[accessibilityHidden()]}
          />
        </HStack>
      </Button>
    </Host>
  );
}
