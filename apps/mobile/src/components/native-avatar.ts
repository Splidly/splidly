import { avatarColorsFor, type AvatarColorScheme } from "../lib/avatar-colors";
import type { NativeSettingsRow } from "./native-activity-list.types";

export function nativeUserAvatar(name: string, userId: string, scheme: AvatarColorScheme): NonNullable<NativeSettingsRow["avatarFallback"]> {
  const colors = avatarColorsFor(`person:${userId}`, scheme);
  return {
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0]?.toUpperCase()).join("") || "?",
    backgroundColor: colors.background,
    foregroundColor: colors.foreground,
  };
}
