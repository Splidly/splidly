import type { ReactNode } from "react";
import type { ScrollViewProps } from "react-native";

export type ActivityListRow = {
  key: string;
  content: ReactNode;
  onDelete?: () => Promise<boolean>;
  deleteLabel?: string;
  deletionDisabled?: boolean;
};

export type ActivityListSection = {
  key: string;
  label: string;
  data: ActivityListRow[];
};

export type NativeActivityListProps = {
  sections: ActivityListSection[];
  header: ReactNode;
  footer?: ReactNode;
  scrollProps: ScrollViewProps & {
    refreshing?: boolean | undefined;
    onRefresh?: (() => Promise<unknown> | void) | undefined;
  };
};
