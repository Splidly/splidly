export type ArchiveLinkProps = {
  label: string;
  count?: number | undefined;
  onPress: () => void;
  icon?: "archive" | "settled";
};
