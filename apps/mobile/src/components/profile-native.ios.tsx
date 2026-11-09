import { Icon } from "@expo/ui";
import { Button, Group, HStack, Image } from "@expo/ui/swift-ui";
import { requireNativeView } from "expo";
import type { ComponentType, PropsWithChildren } from "react";
import type { ColorValue } from "react-native";
import {
  accessibilityHidden, accessibilityLabel, buttonStyle, clipShape, contentShape,
  disabled, frame, backgroundOverlay, shapes, textSelection, resizable, aspectRatio,
} from "@expo/ui/swift-ui/modifiers";
import { ActivityAvatar } from "./activity-avatar.ios";
import type { ProfileNativeActionProps, ProfileNativeAvatarProps, ProfileNativeIconProps } from "./profile-native.types";

export const profileTextModifiers = [textSelection(false)];
export const profileFillModifiers = [frame({ maxWidth: Infinity, alignment: "leading" }), contentShape(shapes.rectangle())];
export const profileCenterModifiers = [frame({ maxWidth: Infinity, alignment: "center" }), contentShape(shapes.rectangle())];
export const profileFlexibleModifiers = [frame({ maxWidth: Infinity, alignment: "leading" })];

type ActionHighlightProps = PropsWithChildren<{
  cornerRadius: number;
  backgroundColor?: ColorValue | undefined;
  testID: string;
}>;
let NativeActionHighlightView: ComponentType<ActionHighlightProps> | undefined;

function ActionHighlightView(props: ActionHighlightProps) {
  // Fast Refresh can deliver this JS before the installed binary contains the
  // new view. Never mount SwiftUI children in an unresolved native component.
  if (!globalThis.expo?.getViewConfig("SplidlySwipe", "ActionHighlightView")) {
    return (
      <Group testID={props.testID} modifiers={[
        buttonStyle("plain"),
        ...(props.backgroundColor ? [backgroundOverlay({ color: props.backgroundColor })] : []),
        clipShape("roundedRectangle", props.cornerRadius),
      ]}>{props.children}</Group>
    );
  }
  NativeActionHighlightView ??= requireNativeView<ActionHighlightProps>(
    "SplidlySwipe", "ActionHighlightView",
  );
  return <NativeActionHighlightView {...props} />;
}

export function ProfileNativeAction({ label, onPress, disabled: inactive = false, testID, children, cornerRadius = 0, backgroundColor }: ProfileNativeActionProps) {
  return (
    <ActionHighlightView cornerRadius={cornerRadius} backgroundColor={backgroundColor} testID={`${testID}-highlight`}>
      <Button testID={testID} onPress={onPress} modifiers={[
        textSelection(false), accessibilityLabel(label), disabled(inactive),
        frame({ maxWidth: Infinity, minHeight: 48, alignment: "leading" }),
        contentShape(shapes.rectangle()),
      ]}><>{children}</></Button>
    </ActionHighlightView>
  );
}

export function ProfileNativeIcon({ name, color, size = 20, tileColor }: ProfileNativeIconProps) {
  const extent = tileColor ? 36 : size;
  return (
    <HStack spacing={0} modifiers={[
      frame({ width: extent, height: extent, alignment: "center" }),
      ...(tileColor ? [backgroundOverlay({ color: tileColor }), clipShape("roundedRectangle", 11)] : []),
      accessibilityHidden(),
    ]}>
      <Icon name={name} color={color} size={size} />
    </HStack>
  );
}

export function ProfileNativeAvatar({ name, userId, imageUrl, size }: ProfileNativeAvatarProps) {
  if (imageUrl?.startsWith("data:image/")) {
    return <Image uiImage={imageUrl} modifiers={[
      resizable(), aspectRatio({ contentMode: "fill" }), frame({ width: size, height: size }), clipShape("circle"), accessibilityHidden(),
    ]} />;
  }
  return <ActivityAvatar name={name} colorKey={userId} imageUrl={imageUrl} size={size} />;
}
