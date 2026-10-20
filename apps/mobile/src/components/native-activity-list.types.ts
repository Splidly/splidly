import type { ReactNode } from "react";
import type { ColorValue, ScrollViewProps } from "react-native";

export type ActivityListRow = {
  key: string;
  content: ReactNode;
  nativeContent?: boolean;
  onDelete?: () => Promise<boolean>;
  deleteLabel?: string;
  actionTitle?: string;
  actionIcon?: string;
  actionColor?: string;
  backgroundColor?: ColorValue;
  deletionDisabled?: boolean;
};

export type ActivityListSection = {
  key: string;
  label: string;
  data: ActivityListRow[];
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
