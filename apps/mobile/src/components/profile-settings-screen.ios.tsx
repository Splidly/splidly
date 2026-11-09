import { useColorScheme } from "react-native";
import { nativeUserAvatar } from "./native-avatar";
import { Children, isValidElement, type ComponentProps, type PropsWithChildren, type ReactNode } from "react";
import type { ActivityListSection, ActivityListRow } from "./native-activity-list.types";
import { ProfileFooter, ProfileIdentity, ProfileSection, ProfileSettingRow } from "./profile-settings";
import { useAvatarFile } from "./activity-avatar.ios";
import { Screen } from "./ui";

const symbols = {
  currency: "dollarsign.arrow.circlepath",
  notifications: "bell.badge",
  terms: "doc.text",
  privacy: "hand.raised",
  info: "info.circle",
  report: "flag",
  signOut: "",
  delete: "",
  edit: "pencil",
  chevron: "chevron.right",
};

// Profile rows are UIKit content configurations, not custom SwiftUI labels.
// The list owns their typography, spacing, accessories and pressed states.
export function ProfileSettingsScreen({ children }: PropsWithChildren) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const sections: ActivityListSection[] = [];
  const header: ReactNode[] = [];
  const footer: ReactNode[] = [];
  let identity: ComponentProps<typeof ProfileIdentity> | undefined;
  let identityRow: ActivityListRow | undefined;
  let version: string | undefined;

  for (const child of Children.toArray(children)) {
    if (isValidElement<ComponentProps<typeof ProfileIdentity>>(child) && child.type === ProfileIdentity) {
      identity = child.props;
      identityRow = {
        key: "profile-identity",
        nativeContent: true,
        content: null,
        ...(!identity.disabled ? { onPress: identity.onPress } : {}),
        settings: {
          title: identity.name,
          subtitle: "Edit name and photo",
          symbol: "",
          avatarFallback: nativeUserAvatar(identity.name, identity.userId, scheme),
          identity: true,
          enabled: !identity.disabled,
          destructive: false,
          showsDisclosure: true,
        },
      };
      sections.push({ key: "profile", label: "", nativeHeader: true, data: [identityRow] });
    } else if (isValidElement<ComponentProps<typeof ProfileSection>>(child) && child.type === ProfileSection) {
      sections.push({
        key: child.props.title,
        label: child.props.title,
        nativeHeader: true,
        ...(child.props.footer ? { nativeFooter: child.props.footer } : {}),
        data: Children.toArray(child.props.children).flatMap((row): ActivityListRow[] => {
          if (!isValidElement<ComponentProps<typeof ProfileSettingRow>>(row) || row.type !== ProfileSettingRow) return [];
          const props = row.props;
          return [{
            key: `profile-setting-${props.icon}`,
            nativeContent: true,
            content: null,
            ...(!props.disabled ? { onPress: props.onPress } : {}),
            settings: {
              title: props.title,
              ...(props.value ? { value: props.value } : {}),
              symbol: symbols[props.icon],
              identity: false,
              enabled: !props.disabled,
              destructive: props.destructive ?? false,
              showsDisclosure: props.showsDisclosureIndicator ?? true,
            },
          }];
        }),
      });
    } else if (isValidElement<ComponentProps<typeof ProfileFooter>>(child) && child.type === ProfileFooter) {
      version = `Splidly${child.props.version ? ` ${child.props.version}` : ""}`;
    } else if (sections.length) {
      footer.push(child);
    } else {
      header.push(child);
    }
  }

  const avatarFile = useAvatarFile(identity?.imageUrl);
  const imageUri = avatarFile ?? identity?.imageUrl;
  if (imageUri && identityRow?.settings) identityRow.settings.imageUri = imageUri;
  const last = sections.at(-1);
  if (last && version) last.nativeFooter = [last.nativeFooter, version].filter(Boolean).join("\n\n");
  if (footer.length) {
    // Keep errors separate from the Account section's native version footer.
    sections.push({ key: "profile-messages", label: "", nativeHeader: true, data: [], footer: <>{footer}</> });
  }
  return <Screen activityList={{ sections }}>{header}</Screen>;
}
