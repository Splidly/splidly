import { Column, Host, Icon, Row, Text } from "@expo/ui";
import type { PropsWithChildren } from "react";
import { useColorScheme, useWindowDimensions, type ColorValue } from "react-native";
import { useTheme } from "../theme";
import {
  ProfileNativeAction, ProfileNativeAvatar, ProfileNativeIcon,
  profileCenterModifiers, profileFillModifiers, profileFlexibleModifiers, profileTextModifiers,
} from "./profile-native";

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
  chevron: Icon.select({ ios: "chevron.right", android: import("@expo/material-symbols/chevron_right.xml") }),
};


export function ProfileText({ children, color, size = 16, weight = "400", testID }: {
  children: string;
  color: ColorValue;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  testID?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const fontSize = process.env.EXPO_OS === "ios" ? size * fontScale : size;
  return <Text {...(testID ? { testID } : {})} textStyle={{ color: color as string, fontSize, fontWeight: weight }} modifiers={profileTextModifiers}>{children}</Text>;
}

export function ProfileIdentity({ name, userId, imageUrl, onPress, disabled = false }: {
  name: string;
  userId: string;
  imageUrl?: string | null;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const dark = useColorScheme() === "dark";
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const Layout = stacked ? Column : Row;
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: "stretch" }}>
      <ProfileNativeAction label={`Edit profile, ${name}`} onPress={onPress} disabled={disabled} testID="profile-identity" cornerRadius={28} backgroundColor={dark ? "#202039" : "#EEEEFF"}>
        <Layout
          testID="profile-identity-content"
          alignment={stacked ? "start" : "center"}
          spacing={20}
          modifiers={profileFillModifiers}
          style={{ padding: 24, ...(process.env.EXPO_OS === "ios" ? {} : { borderRadius: 28, backgroundColor: dark ? "#202039" : "#EEEEFF" }), opacity: disabled ? 0.5 : 1 }}
        >
          <Column alignment="center" style={{ padding: 4, backgroundColor: theme.surface, borderRadius: 48 }}>
            <ProfileNativeAvatar name={name} userId={userId} imageUrl={imageUrl} size={80} />
          </Column>
          <Column alignment="start" spacing={6} modifiers={stacked ? profileFillModifiers : profileFlexibleModifiers}>
            <ProfileText color={theme.muted} size={13}>Your account</ProfileText>
            <ProfileText testID="profile-name" color={theme.text} size={28} weight="700">{name}</ProfileText>
            <Row alignment="center" spacing={6} style={{ paddingTop: 4 }}>
              <ProfileNativeIcon name={icons.edit} color={theme.primary} size={13} />
              <ProfileText color={theme.primary} size={13} weight="600">Edit name and photo</ProfileText>
            </Row>
          </Column>
        </Layout>
      </ProfileNativeAction>
    </Host>
  );
}

export function ProfileSection({ title, footer, children }: PropsWithChildren<{ title: string; footer?: string }>) {
  const theme = useTheme();
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: "stretch" }}>
      <Column alignment="start" spacing={10} modifiers={profileFillModifiers}>
        <ProfileText color={theme.text} size={18} weight="600">{title}</ProfileText>
        <Column spacing={0} modifiers={profileFillModifiers} style={{ backgroundColor: theme.surface, borderRadius: 20 }}>{children}</Column>
        {footer ? <ProfileText color={theme.muted} size={12}>{footer}</ProfileText> : null}
      </Column>
    </Host>
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
  const preference = icon === "currency" || icon === "notifications";
  const tint = destructive ? theme.negative : preference ? theme.primary : theme.muted;
  return (
    <>
      {divider ? <Row modifiers={profileFillModifiers} style={{ paddingLeft: 64 }}><Column modifiers={profileFillModifiers} style={{ height: 0.5, backgroundColor: theme.border }} /></Row> : null}
      <ProfileNativeAction
        label={[title, value, subtitle].filter(Boolean).join(", ")}
        testID={`profile-setting-${icon}`}
        disabled={disabled}
        onPress={onPress}
      >
        <Row alignment="center" spacing={12} modifiers={profileFillModifiers} style={{ paddingHorizontal: 16, paddingVertical: 14, opacity: disabled ? 0.5 : 1 }}>
          <ProfileNativeIcon name={icons[icon]} color={tint} tileColor={destructive ? theme.negativeSurface : theme.elevated} />
          <Column spacing={3} alignment="start" modifiers={profileFlexibleModifiers}>
            <ProfileText color={destructive ? theme.negative : theme.text} weight="500">{title}</ProfileText>
            {subtitle ? <ProfileText color={theme.muted} size={12}>{subtitle}</ProfileText> : null}
          </Column>
          {value ? <ProfileText color={theme.muted} size={14}>{value}</ProfileText> : null}
          {showsDisclosureIndicator ? <ProfileNativeIcon name={icons.chevron} color={theme.subtle} size={12} /> : null}
        </Row>
      </ProfileNativeAction>
    </>
  );
}

export function ProfileFooter({ version }: { version: string | null }) {
  const theme = useTheme();
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: "stretch" }}>
      <Column alignment="center" modifiers={profileCenterModifiers} style={{ paddingVertical: 8 }}>
        <ProfileText color={theme.muted} size={13} weight="500">{`Splidly${version ? ` ${version}` : ""}`}</ProfileText>
      </Column>
    </Host>
  );
}
