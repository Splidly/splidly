import type { CustomImageDataUrl } from "@splidly/shared";
import { Column, Host, Row, TextInput, useNativeState } from "@expo/ui";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { pickCustomImage } from "../lib/custom-image";
import { useTheme } from "../theme";
import { ProfileNativeAction, ProfileNativeAvatar, profileCenterModifiers, profileFillModifiers } from "./profile-native";
import { ProfileText } from "./profile-settings";

export function ProfileEditForm({ name, userId, imageUrl, disabled, onNameChange, onImageChange, onPreparingChange, onSubmit }: {
  name: string;
  userId: string;
  imageUrl: string | null;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onImageChange: (value: CustomImageDataUrl | null) => void;
  onPreparingChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  const theme = useTheme();
  const text = useNativeState(name);
  const choosing = useRef(false);
  const mounted = useRef(true);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    if (text.get() !== name) text.set(name);
  }, [name, text]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function choosePhoto() {
    if (disabled || choosing.current) return;
    choosing.current = true;
    setPreparing(true);
    onPreparingChange(true);
    try {
      const selected = await pickCustomImage();
      if (selected && mounted.current) onImageChange(selected);
    } catch (cause) {
      if (mounted.current) Alert.alert("Couldn’t use that photo", cause instanceof Error ? cause.message : "Choose another photo.");
    } finally {
      choosing.current = false;
      if (mounted.current) {
        setPreparing(false);
        onPreparingChange(false);
      }
    }
  }

  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: "stretch" }}>
      <Column spacing={24} modifiers={profileFillModifiers}>
        <Column alignment="center" spacing={8} modifiers={profileCenterModifiers}>
          <ProfileNativeAction label={imageUrl ? "Change profile photo" : "Add profile photo"} testID="profile-photo" disabled={disabled || preparing} onPress={() => void choosePhoto()}>
            <Column alignment="center" style={{ paddingVertical: 8 }} modifiers={profileCenterModifiers}>
              <ProfileNativeAvatar name={name || "?"} userId={userId} imageUrl={imageUrl} size={104} />
            </Column>
          </ProfileNativeAction>
          <ProfileNativeAction label={imageUrl ? "Change photo" : "Add photo"} testID="profile-change-photo" disabled={disabled || preparing} onPress={() => void choosePhoto()}>
            <Column alignment="center" modifiers={profileCenterModifiers}>
              <ProfileText color={theme.primary} size={15} weight="600">{preparing ? "Preparing…" : imageUrl ? "Change photo" : "Add photo"}</ProfileText>
            </Column>
          </ProfileNativeAction>
          {imageUrl ? (
            <ProfileNativeAction label="Remove profile photo" testID="profile-remove-photo" disabled={disabled || preparing} onPress={() => onImageChange(null)}>
              <Column alignment="center" modifiers={profileCenterModifiers}>
                <ProfileText color={theme.negative} size={15}>Remove photo</ProfileText>
              </Column>
            </ProfileNativeAction>
          ) : null}
        </Column>
        <Column alignment="start" spacing={8} modifiers={profileFillModifiers}>
          <ProfileText color={theme.muted} size={13} weight="500">Display name</ProfileText>
          <TextInput
            testID="profile-display-name"
            accessibilityLabel="Display name"
            value={text}
            onChangeText={onNameChange}
            onSubmitEditing={onSubmit}
            editable={!disabled}
            autoFocus={false}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={80}
            textStyle={{ fontSize: 17, color: theme.text as string }}
            style={{ width: "100%", backgroundColor: theme.elevated, borderRadius: 14, padding: 16 }}
          />
          <ProfileText color={theme.muted} size={13}>Your photo and name are visible to the people you split with.</ProfileText>
        </Column>
      </Column>
    </Host>
  );
}

export function ProfileEditAndroidActions({ onCancel, onSave, disabled, canSave }: {
  onCancel: () => void;
  onSave: () => void;
  disabled: boolean;
  canSave: boolean;
}) {
  const theme = useTheme();
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: "stretch" }}>
      <Column spacing={16} modifiers={profileFillModifiers}>
        <Row modifiers={profileFillModifiers}>
          <Column style={{ width: "50%" }}>
            <ProfileNativeAction label="Cancel profile changes" testID="profile-cancel" disabled={disabled} onPress={onCancel}>
              <Column style={{ padding: 12 }}><ProfileText color={theme.primary}>Cancel</ProfileText></Column>
            </ProfileNativeAction>
          </Column>
          <Column style={{ width: "50%" }}>
            <ProfileNativeAction label="Save profile" testID="profile-save" disabled={!canSave} onPress={onSave}>
              <Column style={{ padding: 12 }}><ProfileText color={canSave ? theme.primary : theme.subtle} weight="600">Save</ProfileText></Column>
            </ProfileNativeAction>
          </Column>
        </Row>
        <ProfileText color={theme.text} size={24} weight="700">Edit profile</ProfileText>
      </Column>
    </Host>
  );
}
