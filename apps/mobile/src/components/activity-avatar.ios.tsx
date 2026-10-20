import { Image, Text } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  aspectRatio,
  backgroundOverlay,
  clipShape,
  font,
  foregroundStyle,
  frame,
  resizable,
} from "@expo/ui/swift-ui/modifiers";
import { Image as CachedImage } from "expo-image";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { avatarColorsFor } from "../lib/avatar-colors";

export function useAvatarFile(url: string | null | undefined) {
  const [cached, setCached] = useState<{ url: string; file: string }>();
  useEffect(() => {
    let active = true;
    if (url) {
      void (async () => {
        try {
          await CachedImage.prefetch(url, { cachePolicy: "disk" });
          const file = await CachedImage.getCachePathAsync(url);
          if (active && file)
            setCached({
              url,
              file: file.startsWith("file://") ? file : `file://${file}`,
            });
        } catch {
          /* Keep the initials when a photo cannot be loaded. */
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [url]);
  return cached?.url === url ? cached?.file : undefined;
}

export function ActivityAvatar({
  name,
  colorKey,
  imageUrl,
  size = 44,
}: {
  name: string;
  colorKey: string;
  imageUrl?: string | null | undefined;
  size?: number;
}) {
  const file = useAvatarFile(imageUrl);
  const colors = avatarColorsFor(
    `person:${colorKey}`,
    useColorScheme() === "dark" ? "dark" : "light",
  );
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return file ? (
    <Image
      uiImage={file}
      modifiers={[
        resizable(),
        aspectRatio({ contentMode: "fill" }),
        frame({ width: size, height: size }),
        clipShape("circle"),
        accessibilityHidden(),
      ]}
    />
  ) : (
    <Text
      modifiers={[
        font({ size: size * 0.36, weight: "bold" }),
        foregroundStyle(colors.foreground),
        frame({ width: size, height: size }),
        backgroundOverlay({ color: colors.background }),
        clipShape("circle"),
        accessibilityHidden(),
      ]}
    >
      {initials}
    </Text>
  );
}
