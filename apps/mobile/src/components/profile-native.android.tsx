import { Icon } from "@expo/ui";
import { Box, Image, Shape, Text, TextButton } from "@expo/ui/jetpack-compose";
import { background, clip, fillMaxWidth, semantics, Shapes, size, testID as testIDModifier, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { avatarColorsFor } from "../lib/avatar-colors";
import { useTheme } from "../theme";
import type { ProfileNativeActionProps, ProfileNativeAvatarProps, ProfileNativeIconProps } from "./profile-native.types";

export const profileTextModifiers = [];
export const profileFillModifiers = [fillMaxWidth()];
export const profileCenterModifiers = [fillMaxWidth()];
export const profileFlexibleModifiers = [weight(1)];

export function ProfileNativeAction({ label, onPress, disabled = false, testID, children }: ProfileNativeActionProps) {
  const theme = useTheme();
  return (
    <TextButton
      enabled={!disabled}
      onClick={onPress}
      contentPadding={{ start: 0, top: 0, end: 0, bottom: 0 }}
      colors={{ containerColor: "transparent", contentColor: theme.text, disabledContainerColor: "transparent", disabledContentColor: theme.subtle }}
      shape={Shape.Rectangle({})}
      modifiers={[fillMaxWidth(), semantics({ contentDescription: label }), testIDModifier(testID)]}
    >{children}</TextButton>
  );
}

export function ProfileNativeIcon({ name, color, size: glyphSize = 20, tileColor }: ProfileNativeIconProps) {
  const extent = tileColor ? 36 : glyphSize;
  return (
    <Box contentAlignment="center" modifiers={[
      size(extent, extent),
      ...(tileColor ? [clip(Shapes.RoundedCorner(11)), background(tileColor)] : []),
    ]}>
      <Icon name={name} color={color} size={glyphSize} />
    </Box>
  );
}

export function ProfileNativeAvatar({ name, userId, imageUrl, size: extent }: ProfileNativeAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const colors = avatarColorsFor(`person:${userId}`, useColorScheme() === "dark" ? "dark" : "light");
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return (
    <Box contentAlignment="center" modifiers={[size(extent, extent), clip(Shapes.Circle), background(colors.background)]}>
      {imageUrl && imageUrl !== failedUrl ? (
        <Image source={{ uri: imageUrl }} contentScale="crop" contentDescription={null} modifiers={[size(extent, extent)]} onError={() => setFailedUrl(imageUrl)} />
      ) : (
        <Text color={colors.foreground} style={{ fontSize: extent * 0.36, fontWeight: "700" }}>{initials}</Text>
      )}
    </Box>
  );
}
