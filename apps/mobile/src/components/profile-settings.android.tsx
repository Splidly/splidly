import { Icon } from "@expo/ui";
import { Host } from "@expo/ui/jetpack-compose";
import type { PropsWithChildren } from "react";
import { Pressable, Text, View, type ColorValue } from "react-native";
import { useTheme } from "../theme";
import { Avatar, RowDivider } from "./ui";

const icons = {
  edit: Icon.select({ ios: "pencil", android: import("@expo/material-symbols/edit.xml") }),
  currency: Icon.select({ ios: "dollarsign.arrow.circlepath", android: import("@expo/material-symbols/currency_exchange.xml") }),
  notifications: Icon.select({ ios: "bell.badge", android: import("@expo/material-symbols/notifications.xml") }),
  terms: Icon.select({ ios: "doc.text", android: import("@expo/material-symbols/description.xml") }),
  privacy: Icon.select({ ios: "hand.raised", android: import("@expo/material-symbols/shield.xml") }),
  info: Icon.select({ ios: "info.circle", android: import("@expo/material-symbols/info.xml") }),
  report: Icon.select({ ios: "flag", android: import("@expo/material-symbols/flag.xml") }),
  signOut: Icon.select({ ios: "rectangle.portrait.and.arrow.right", android: import("@expo/material-symbols/logout.xml") }),
  delete: Icon.select({ ios: "trash", android: import("@expo/material-symbols/delete_forever.xml") }),
};

export function ProfileText({ children, color, size = 16, weight = "400", testID }: {
  children: string;
  color: ColorValue;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  testID?: string;
}) {
  return <Text selectable={false} testID={testID} style={{ color, fontSize: size, lineHeight: Math.round(size * 1.35), fontWeight: weight }}>{children}</Text>;
}

function SettingIcon({ name, color }: { name: keyof typeof icons; color: ColorValue }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Host style={{ width: 24, height: 24 }}>
        <Icon name={icons[name]} color={color} size={24} />
      </Host>
    </View>
  );
}

export function ProfileIdentity({ name, userId, imageUrl, onPress, disabled = false }: {
  name: string;
  userId: string;
  imageUrl?: string | null;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID="profile-identity"
      accessibilityRole="button"
      accessibilityLabel={`Edit profile, ${name}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ padding: 20, borderRadius: 24, backgroundColor: pressed ? theme.elevated : theme.surface, opacity: disabled ? 0.5 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Avatar name={name} colorKey={userId} imageUrl={imageUrl} size={64} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <ProfileText color={theme.muted} size={13}>Your account</ProfileText>
          <ProfileText testID="profile-name" color={theme.text} size={24} weight="700">{name}</ProfileText>
          <View style={{ paddingTop: 4 }}>
            <ProfileText color={theme.primary} size={14} weight="600">Edit name and photo</ProfileText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function ProfileSection({ title, footer, children }: PropsWithChildren<{ title: string; footer?: string }>) {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 4 }}><ProfileText color={theme.text} size={17} weight="600">{title}</ProfileText></View>
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: theme.surface }}>{children}</View>
      {footer ? <View style={{ paddingHorizontal: 4 }}><ProfileText color={theme.muted} size={13}>{footer}</ProfileText></View> : null}
    </View>
  );
}

export function ProfileSettingRow({ title, subtitle, value, icon, onPress, disabled = false, destructive = false, divider = false, showsDisclosureIndicator = true }: {
  title: string;
  subtitle?: string | undefined;
  value?: string | undefined;
  icon: keyof typeof icons;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  divider?: boolean;
  showsDisclosureIndicator?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? theme.negative : theme.text;
  return (
    <>
      {divider ? <RowDivider inset={60} /> : null}
      <Pressable
        testID={`profile-setting-${icon}`}
        accessibilityRole="button"
        accessibilityLabel={[title, value, subtitle].filter(Boolean).join(", ")}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({ minHeight: 64, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: pressed ? theme.elevated : "transparent", opacity: disabled ? 0.5 : 1 })}
      >
        <SettingIcon name={icon} color={destructive ? theme.negative : theme.primary} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <ProfileText color={color} weight="500">{title}</ProfileText>
          {subtitle ? <ProfileText color={theme.muted} size={13}>{subtitle}</ProfileText> : null}
        </View>
        {value ? <View style={{ maxWidth: "35%" }}><ProfileText color={theme.muted} size={14}>{value}</ProfileText></View> : null}
        {showsDisclosureIndicator ? <Text selectable={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: theme.subtle, fontSize: 24 }}>›</Text> : null}
      </Pressable>
    </>
  );
}

export function ProfileFooter({ version }: { version: string | null }) {
  const theme = useTheme();
  return <View style={{ alignItems: "center", paddingVertical: 8 }}><ProfileText color={theme.muted} size={13}>{`Splidly${version ? ` ${version}` : ""}`}</ProfileText></View>;
}
