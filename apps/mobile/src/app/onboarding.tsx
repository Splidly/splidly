import type { CurrencyCode } from "@splidly/shared";
import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  PrimaryButton,
  Screen,
  SheetCloseButton,
} from "../components/ui";
import { CurrencyField } from "../components/currency-field";
import { authClient } from "../lib/auth-client";
import { isSupportedCurrency } from "../lib/currencies";
import { pendingInvite } from "../lib/pending-invite";
import { api } from "../lib/trpc";
import { spacing, useTheme } from "../theme";

function getDeviceCurrency(): CurrencyCode | null {
  const currency = getLocales()[0]?.currencyCode;
  return currency && isSupportedCurrency(currency) ? currency : null;
}

function providerDisplayName(name?: string) {
  const normalized = name?.trim();
  return normalized && normalized !== "New user" && normalized !== "Deleted user"
    ? normalized
    : "";
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const completed = useRef(false);
  const cancelling = useRef(false);
  const [name, setName] = useState<string | undefined>(undefined);
  const [deviceCurrency] = useState<CurrencyCode | null>(getDeviceCurrency);
  const [currency, setCurrency] = useState<CurrencyCode>(
    deviceCurrency ?? "EUR",
  );
  const update = api.profile.update.useMutation({
    async onSuccess() {
      completed.current = true;
      await utils.profile.me.invalidate();
      const token = await pendingInvite.get();
      requestAnimationFrame(() => {
        router.dismissAll();
        router.replace(token ? `/invite/${token}` : "/(tabs)/friends");
      });
    },
  });
  const cancel = api.profile.deleteAccount.useMutation();

  const cancelSetup = useCallback(async () => {
    if (completed.current || cancelling.current) return;
    cancelling.current = true;
    try {
      await cancel.mutateAsync({ confirmation: "DELETE" });
      await authClient.signOut();
      await utils.invalidate();
    } catch {
      cancelling.current = false;
    }
  }, [cancel, utils]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "background") return;
      void cancelSetup();
    });
    return () => subscription.remove();
  }, [cancelSetup]);

  const displayName = name ?? providerDisplayName(profile.data?.displayName);

  function cancelAndClose() {
    router.dismiss();
    void cancelSetup();
  }

  function submit() {
    if (!displayName.trim()) return;
    update.mutate({
      displayName: displayName.trim(),
      homeCurrency: currency,
    });
  }

  return (
    <Screen
      background="sheet"
      contentContainerStyle={styles.content}
    >
      <SheetCloseButton
        label="Cancel account setup"
        disabled={cancel.isPending || update.isPending}
        onPress={cancelAndClose}
      />

      <View style={styles.hero}>
        <Avatar
          name={displayName || "Splidly"}
          colorKey={profile.data?.userId}
          imageUrl={profile.data?.avatarUrl}
          size={72}
        />
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>
            Make Splidly yours
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Check the details your friends will see.
          </Text>
        </View>
      </View>

      <FormSection
        footer={
          deviceCurrency
            ? `${deviceCurrency} was suggested from this device. You can change both details later.`
            : "You can change both details later in Profile."
        }
      >
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Your name"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />
        <CurrencyField
          label="Home currency"
          value={currency}
          onValueChange={setCurrency}
        />
      </FormSection>

      <View style={styles.footer}>
        <PrimaryButton
          label={
            cancel.isPending
              ? "Cancelling…"
              : update.isPending
                ? "Saving…"
                : "Continue"
          }
          onPress={submit}
          disabled={
            cancel.isPending || update.isPending || !displayName.trim()
          }
        />
        <Text style={[styles.privacy, { color: theme.muted }]}>
          Your home currency only affects new balance snapshots.
        </Text>
        {update.error ? <ErrorState message={update.error.message} /> : null}
        {cancel.error ? <ErrorState message={cancel.error.message} /> : null}
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
  privacy: {
    paddingHorizontal: spacing.md,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
