import type { ComponentProps, PropsWithChildren } from "react";
import type { ColorValue } from "react-native";
import type { Icon } from "@expo/ui";

export type ProfileNativeActionProps = PropsWithChildren<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
  cornerRadius?: number;
  backgroundColor?: ColorValue;
}>;

export type ProfileNativeIconProps = {
  name: ComponentProps<typeof Icon>["name"];
  color: ColorValue;
  size?: number;
  tileColor?: ColorValue;
};

export type ProfileNativeAvatarProps = {
  name: string;
  userId: string;
  imageUrl?: string | null | undefined;
  size: number;
};
