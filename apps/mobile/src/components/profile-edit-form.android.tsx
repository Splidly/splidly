import type { CustomImageDataUrl } from "@splidly/shared";
import { PictureEditor } from "./picture-editor";
import { Avatar, Field, FormSection } from "./ui";

export function ProfileEditForm({
  name, userId, imageUrl, disabled, onNameChange, onImageChange, onPreparingChange, onSubmit,
}: {
  name: string;
  userId: string;
  imageUrl: string | null;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onImageChange: (value: CustomImageDataUrl | null) => void;
  onPreparingChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <PictureEditor
        label="profile photo"
        imageUrl={imageUrl}
        disabled={disabled}
        onImageChange={onImageChange}
        onPreparingChange={onPreparingChange}
        preview={<Avatar name={name || "?"} colorKey={userId} imageUrl={imageUrl} size={96} />}
      />
      <FormSection footer="Your photo and name are visible to the people you split with.">
        <Field
          label="Name"
          accessibilityLabel="Display name"
          value={name}
          onChangeText={onNameChange}
          onSubmitEditing={onSubmit}
          editable={!disabled}
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={80}
          placeholder="Your name"
        />
      </FormSection>
    </>
  );
}
