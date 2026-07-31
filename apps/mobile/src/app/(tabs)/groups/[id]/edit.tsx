import type {
  CurrencyCode,
  CustomImageDataUrl,
  GroupColor,
  GroupIconKey,
} from "@splidly/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CurrencyField } from "../../../../components/currency-field";
import { GroupColorPicker } from "../../../../components/group-color-picker";
import {
  GroupIcon,
  GroupIconPicker,
  normalizeGroupIconKey,
} from "../../../../components/group-icon";
import { PictureEditor } from "../../../../components/picture-editor";
import {
  ErrorState,
  Field,
  FormSection,
  LoadingState,
  PrimaryButton,
  Screen,
  SheetCloseButton,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";
import {
  normalizeGroupColor,
} from "../../../../lib/group-colors";
import { spacing, useTheme } from "../../../../theme";

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const utils = api.useUtils();
  const group = detail.data?.group;
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<GroupIconKey>("default");
  const [color, setColor] = useState<GroupColor>("#4745B8");
  const [imageUrl, setImageUrl] = useState<CustomImageDataUrl | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setIconKey(normalizeGroupIconKey(group.iconKey));
    setColor(normalizeGroupColor(group.color, group.id));
    setImageUrl((group.imageUrl as CustomImageDataUrl | null) ?? null);
    setCurrency(group.currency as CurrencyCode);
  }, [group?.id, group?.version]);

  const update = api.groups.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.detail.invalidate({ groupId: id }),
        utils.groups.list.invalidate(),
      ]);
      router.back();
    },
  });

  if (detail.isPending) {
    return (
      <Screen scroll={false} background="sheet">
        <LoadingState />
      </Screen>
    );
  }
  if (detail.error || !group) {
    return (
      <Screen scroll={false} background="sheet">
        <SheetCloseButton
          label="Close edit group"
          onPress={() => router.back()}
        />
        <ErrorState
          message={detail.error?.message ?? "Unable to load this group."}
        />
      </Screen>
    );
  }

  return (
    <Screen
      background="sheet"
      contentContainerStyle={styles.content}
    >
      <SheetCloseButton
        label="Close edit group"
        disabled={update.isPending}
        onPress={() => router.back()}
      />

      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.text }]}>
          Edit group
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Update how this group appears.
        </Text>
      </View>

      <PictureEditor
        label="group photo"
        imageUrl={imageUrl}
        disabled={update.isPending}
        onImageChange={setImageUrl}
        preview={
          <GroupIcon
            iconKey={iconKey}
            name={name || group.name}
            colorKey={group.id}
            color={color}
            imageUrl={imageUrl}
            size={88}
          />
        }
      />

      {imageUrl ? null : (
        <GroupColorPicker value={color} onValueChange={setColor} />
      )}

      <FormSection footer="The accounting currency locks after the first expense or settlement.">
        <Field
          leading={
            imageUrl ? (
              <GroupIcon
                iconKey={iconKey}
                name={name || group.name}
                colorKey={group.id}
                color={color}
                imageUrl={imageUrl}
              />
            ) : (
              <GroupIconPicker
                value={iconKey}
                onValueChange={setIconKey}
                name={name || group.name}
                colorKey={group.id}
                color={color}
              />
            )
          }
          value={name}
          onChangeText={setName}
          accessibilityLabel="Group name"
          placeholder="Group name"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={styles.nameInput}
        />
        <CurrencyField
          label="Currency"
          value={currency}
          onValueChange={setCurrency}
        />
      </FormSection>

      <View style={styles.footer}>
        <PrimaryButton
          label={update.isPending ? "Saving…" : "Save changes"}
          disabled={update.isPending || name.trim().length === 0}
          onPress={() =>
            update.mutate({
              groupId: id,
              expectedVersion: group.version,
              name: name.trim(),
              iconKey,
              color,
              imageUrl,
              currency,
              simplifyDebts: group.simplifyDebts,
            })
          }
        />
        {update.error ? <ErrorState message={update.error.message} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 310,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  footer: {
    gap: spacing.sm,
  },
  nameInput: {
    textAlign: "left",
  },
});
