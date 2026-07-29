import type { CurrencyCode } from "@splidly/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CurrencyField } from "../../../components/currency-field";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  PrimaryButton,
  Screen,
  SheetCloseButton,
} from "../../../components/ui";
import { api } from "../../../lib/trpc";
import { spacing, useTheme } from "../../../theme";

export default function NewGroupScreen() {
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const [name, setName] = useState("");
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
      scroll={false}
      background="sheet"
      contentContainerStyle={styles.content}
    >
      <SheetCloseButton
        label="Close new group"
        disabled={create.isPending}
        onPress={() => router.back()}
      />

      <View style={styles.hero}>
        <Avatar name={name || "New group"} variant="group" size={72} />
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>
            Create a group
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Set up a shared ledger for your next plan.
          </Text>
        </View>
      </View>

      <FormSection footer="The accounting currency locks after the first expense or settlement.">
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Lisbon weekend"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
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
    gap: spacing.xl,
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
});
