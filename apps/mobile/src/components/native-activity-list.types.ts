import type { ReactNode } from "react";
import type { ColorValue, ScrollViewProps } from "react-native";

export type ActivityPreviewDetail = {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
};

export type ActivityPreview = {
  title: string;
  subtitle: string;
  symbol: string;
  imageUrl?: string | null;
  avatarFallback?: NativeSettingsRow["avatarFallback"];
  headline: string;
  caption: string;
  tone?: "positive" | "negative" | "neutral";
  debts?: ActivityPreviewDetail[];
  debtNote?: string;
  details: ActivityPreviewDetail[];
};

export type NativeSettingsRow = {
  title: string;
  value?: string;
  subtitle?: string;
  symbol: string;
  identity: boolean;
  enabled: boolean;
  destructive: boolean;
  showsDisclosure: boolean;
  imageUri?: string;
  avatar?: boolean;
  avatarFallback?: {
    initials: string;
    backgroundColor: string;
    foregroundColor: string;
    rounded?: boolean;
  };
  valueTone?: "positive" | "negative" | "muted";
  balances?: { label: string; value: string; color: ColorValue }[];
  disclosure?: boolean;
  toggleValue?: boolean;
  details?: { title: string; value: string; tone: "positive" | "negative" | "muted" }[];
};

export type ActivityListRow = {
  key: string;
  content: ReactNode;
  nativeContent?: boolean;
  settings?: NativeSettingsRow;
  // iOS list cells can own taps and their system highlight instead of an
  // embedded SwiftUI button. Other rows retain their existing interaction.
  onPress?: () => void;
  preview?: ActivityPreview;
  onPreviewOpen?: () => void;
  previewActions?: ActivityPreviewAction[];
  onDelete?: () => Promise<boolean>;
  deleteLabel?: string;
  actionTitle?: string;
  actionIcon?: string;
  actionColor?: string;
  backgroundColor?: ColorValue;
  deletionDisabled?: boolean;
};

export type ActivityPreviewAction = {
  id: string;
  title: string;
  symbol: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<unknown>;
};

export type ActivityListSection = {
  key: string;
  label: string;
  nativeHeader?: boolean;
  nativeFooter?: string;
  data: ActivityListRow[];
  footer?: ReactNode;
};

export type NativeActivityListProps = {
  appearance?: "plain" | "grouped";
  sections: ActivityListSection[];
  header: ReactNode;
  footer?: ReactNode;
  scrollProps: ScrollViewProps & {
    refreshing?: boolean | undefined;
    onRefresh?: (() => Promise<unknown> | void) | undefined;
  };
};
