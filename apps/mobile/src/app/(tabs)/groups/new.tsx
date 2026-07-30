import type {
  CurrencyCode,
  GroupColor,
  GroupIconKey,
} from "@splidly/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CurrencyField } from "../../../components/currency-field";
import { GroupColorPicker } from "../../../components/group-color-picker";
import { GroupIconPicker } from "../../../components/group-icon";
import {
  ErrorState,
  Field,
  FormSection,
  PrimaryButton,
  Screen,
  SheetCloseButton,
} from "../../../components/ui";
import { api } from "../../../lib/trpc";
import { randomGroupColor } from "../../../lib/group-colors";
import { spacing, useTheme } from "../../../theme";

export default function NewGroupScreen() {
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<GroupIconKey>("default");
  const [color, setColor] = useState<GroupColor>(() => randomGroupColor());
  const [currency, setCurrency] = useState<CurrencyCode>();
  const create = api.groups.create.useMutation({
    async onSuccess(group) {
      await utils.groups.list.invalidate();
      router.replace(`/groups/${group.id}`);
    },
  });
  const selectedCurrency = (
    currency ??
    profile.data?.homeCurrency ??
    "EUR"
  ) as CurrencyCode;

  return (
    <Screen
      background="sheet"
      contentContainerStyle={styles.content}
    >
      <SheetCloseButton
        label="Close new group"
        disabled={create.isPending}
        onPress={() => router.back()}
      />

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>
            Create a group
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Set up a shared ledger for your next plan.
          </Text>
        </View>
      </View>

      <GroupColorPicker value={color} onValueChange={setColor} />

      <FormSection footer="The accounting currency locks after the first expense or settlement.">
        <Field
          leading={
            <GroupIconPicker
              value={iconKey}
              onValueChange={setIconKey}
              name={name || "New group"}
              colorKey="new-group"
              color={color}
            />
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
          value={selectedCurrency}
          onValueChange={setCurrency}
        />
      </FormSection>

      <View style={styles.footer}>
        <PrimaryButton
          label={create.isPending ? "Creating…" : "Create group"}
          disabled={create.isPending || name.trim().length === 0}
          onPress={() =>
            create.mutate({
              name: name.trim(),
              iconKey,
              color,
              currency: selectedCurrency,
            })
          }
        />
        {create.error ? <ErrorState message={create.error.message} /> : null}
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  heroCopy: {
    alignItems: "center",
    gap: spacing.xs,
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
