import type { CustomImageDataUrl } from "@splidly/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { pickCustomImage } from "../lib/custom-image";
import { spacing, useTheme } from "../theme";

export function PictureEditor({
  imageUrl,
  onImageChange,
  preview,
  label,
  disabled = false,
  onPreparingChange,
}: {
  imageUrl?: string | null | undefined;
  onImageChange: (value: CustomImageDataUrl | null) => void;
  preview: ReactNode;
  label: string;
  disabled?: boolean;
  onPreparingChange?: (preparing: boolean) => void;
}) {
  const theme = useTheme();
  const [isPicking, setIsPicking] = useState(false);
  const picking = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function choosePhoto() {
    if (disabled || picking.current) return;
    picking.current = true;
    setIsPicking(true);
    onPreparingChange?.(true);
    try {
      const selected = await pickCustomImage();
      if (selected && mounted.current) onImageChange(selected);
    } catch (cause) {
      if (mounted.current) Alert.alert(
        "Couldn’t use that photo",
        cause instanceof Error ? cause.message : "Choose another photo.",
      );
    } finally {
      picking.current = false;
      if (mounted.current) {
        setIsPicking(false);
        onPreparingChange?.(false);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${imageUrl ? "Change" : "Add"} ${label}`}
        disabled={disabled || isPicking}
        onPress={() => void choosePhoto()}
        style={({ pressed }) => [
          styles.preview,
          { opacity: disabled ? 0.5 : pressed ? 0.72 : 1 },
        ]}
      >
        {preview}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.badge,
            {
              backgroundColor: theme.primary,
              borderColor: theme.surface,
            },
          ]}
        >
          <Text selectable={false} style={[styles.badgeGlyph, { color: theme.primaryText }]}>+</Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || isPicking}
          onPress={() => void choosePhoto()}
          hitSlop={8}
        >
          <Text
            selectable={false}
            style={{
              color: disabled ? theme.subtle : theme.primary,
              fontSize: 15,
              fontWeight: "600",
            }}
          >
            {isPicking
              ? "Preparing…"
              : imageUrl
                ? "Change photo"
                : "Add photo"}
          </Text>
        </Pressable>
        {imageUrl ? (
          <>
            <Text selectable={false} style={{ color: theme.subtle }}>·</Text>
            <Pressable
              accessibilityRole="button"
              disabled={disabled || isPicking}
              onPress={() => onImageChange(null)}
              hitSlop={8}
            >
              <Text
                selectable={false}
                style={{
                  color: disabled ? theme.subtle : theme.negative,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Remove
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  preview: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGlyph: {
    fontSize: 20,
    lineHeight: 21,
    fontWeight: "600",
  },
  actions: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
});
