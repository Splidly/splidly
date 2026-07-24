import type { CurrencyCode } from "@splidly/shared";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Text } from "react-native";
import {
  ErrorState,
  Field,
  FormSection,
  ListRow,
  RowDivider,
  Screen,
  Section,
} from "../../../components/ui";
import { CurrencyField } from "../../../components/currency-field";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/trpc";
import { useTheme } from "../../../theme";

type SavedProfile = {
  displayName: string;
  homeCurrency: CurrencyCode;
};

export default function ProfileScreen() {
  const theme = useTheme();
  const profile = api.profile.me.useQuery();
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const initializedUser = useRef<string | undefined>(undefined);
  const saved = useRef<SavedProfile | undefined>(undefined);
  const lastAttempted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!profile.data || initializedUser.current === profile.data.userId) return;
    const initial = {
      displayName: profile.data.displayName,
      homeCurrency: profile.data.homeCurrency as CurrencyCode,
    };
    initializedUser.current = profile.data.userId;
    saved.current = initial;
    setName(initial.displayName);
    setCurrency(initial.homeCurrency);
  }, [profile.data]);

  const update = api.profile.update.useMutation({
    async onSuccess(updated) {
      if (!updated) return;
      saved.current = {
        displayName: updated.displayName,
        homeCurrency: updated.homeCurrency as CurrencyCode,
      };
      lastAttempted.current = undefined;
      utils.profile.me.setData(undefined, updated);
      await Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!initializedUser.current || update.isPending) return;
    const displayName = name.trim();
    const current = saved.current;
    const draftKey = `${displayName}\u0000${currency}`;
    if (
      displayName.length === 0 ||
      lastAttempted.current === draftKey ||
      (current?.displayName === displayName &&
        current.homeCurrency === currency)
    ) {
      return;
    }
    const timer = setTimeout(() => {
      lastAttempted.current = draftKey;
      update.mutate({ displayName, homeCurrency: currency });
    }, 500);
    return () => clearTimeout(timer);
  }, [currency, name, update.isPending]);

  const remove = api.profile.deleteAccount.useMutation({
    async onSuccess() {
      queryClient.clear();
      await authClient.signOut();
      router.replace("/sign-in");
    },
  });

  async function signOut() {
    queryClient.clear();
    await authClient.signOut();
    router.replace("/sign-in");
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "All balances must be settled and all groups left. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove.mutate({ confirmation: "DELETE" }),
        },
      ],
    );
  }

  return (
    <Screen>
      <FormSection
        title="Profile"
        footer="Currency changes apply to new entries only. Historical balances stay in their original buckets."
      >
        <Field
          label="Display name"
          value={name}
          onChangeText={setName}
        />
        <CurrencyField
          label="Home currency"
          value={currency}
          onValueChange={setCurrency}
        />
      </FormSection>
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: theme.muted, fontSize: 13, textAlign: "center" }}
      >
        {update.isPending ? "Saving…" : "Changes save automatically"}
      </Text>
      <Section title="Account">
        <ListRow
          title="Sign out"
          onPress={() => void signOut()}
        />
        <RowDivider inset={16} />
        <ListRow
          title="Delete account"
          destructive
          onPress={confirmDelete}
        />
      </Section>
      {update.error ? <ErrorState message={update.error.message} /> : null}
      {remove.error ? <ErrorState message={remove.error.message} /> : null}
    </Screen>
  );
}
