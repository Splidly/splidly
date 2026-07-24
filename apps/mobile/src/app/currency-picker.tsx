import type { CurrencyCode } from "@splidly/shared";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  endCurrencySelection,
  getCurrencySelection,
} from "../lib/currency-selection";
import {
  currencies,
  addRecentCurrency,
  getCurrency,
  loadRecentCurrencies,
  rememberCurrency,
  type CurrencyOption,
} from "../lib/currencies";
import { useTheme } from "../theme";

type CurrencySection = {
  title: string;
  data: CurrencyOption[];
};

function mergeRecentCurrencies(
  stored: readonly CurrencyCode[],
  contextual: readonly CurrencyCode[],
) {
  return contextual
    .slice()
    .reverse()
    .reduce(
      (recent, currency) => addRecentCurrency(recent, currency),
      [...stored],
    );
}

export default function CurrencyPickerScreen() {
  const theme = useTheme();
  const selection = useRef(getCurrencySelection()).current;
  const [value, setValue] = useState<CurrencyCode>(selection?.value ?? "EUR");
  const [query, setQuery] = useState("");
  const contextualCurrencies = useRef<CurrencyCode[]>(
    selection
      ? [selection.value, ...selection.recentCurrencies]
          .filter(
            (currency, index, values) =>
              values.indexOf(currency) === index,
          )
          .slice(0, 5)
      : [],
  ).current;
  const [recentCodes, setRecentCodes] = useState<CurrencyCode[]>(
    contextualCurrencies,
  );

  useEffect(() => {
    void loadRecentCurrencies().then((stored) =>
      setRecentCodes(mergeRecentCurrencies(stored, contextualCurrencies)),
    );
  }, [contextualCurrencies]);

  useEffect(
    () => () => {
      endCurrencySelection(selection);
    },
    [selection],
  );

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return currencies;
    return currencies.filter(
      ({ code, name }) =>
        code.toLocaleLowerCase().includes(normalized) ||
        name.toLocaleLowerCase().includes(normalized),
    );
  }, [query]);

  const recent = useMemo(
    () =>
      recentCodes
        .map((code) => getCurrency(code))
        .filter((currency): currency is CurrencyOption => Boolean(currency))
        .filter((currency) => matches.includes(currency)),
    [matches, recentCodes],
  );

  const sections = useMemo<CurrencySection[]>(
    () => {
      if (matches.length === 0) return [];
      const recentSet = new Set(recent.map(({ code }) => code));
      const all = matches.filter(({ code }) => !recentSet.has(code));
      return [
        ...(recent.length > 0
          ? [{ title: "Recently Used", data: recent }]
          : []),
        ...(all.length > 0
          ? [{ title: "All Currencies", data: all }]
          : []),
      ];
    },
    [matches, recent],
  );

  function close() {
    endCurrencySelection(selection);
    router.back();
  }

  function select(currency: CurrencyCode) {
    setValue(currency);
    selection?.onSelect(currency);
    void rememberCurrency(currency);
    close();
  }

  return (
    <>
      <SectionList
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ paddingBottom: 32 }}
        sections={sections}
        keyExtractor={(currency) => currency.code}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={7}
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              color: theme.muted,
              fontSize: 13,
              fontWeight: "600",
              letterSpacing: 0.4,
              textTransform: "uppercase",
              paddingHorizontal: 32,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Pressable
              testID={`currency-${item.code}`}
              onPress={() => select(item.code)}
              style={({ pressed }) => ({
                minHeight: 58,
                marginHorizontal: 16,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: pressed ? theme.elevated : theme.surface,
                borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
                borderTopLeftRadius: first ? 16 : 0,
                borderTopRightRadius: first ? 16 : 0,
                borderBottomLeftRadius: last ? 16 : 0,
                borderBottomRightRadius: last ? 16 : 0,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.text, fontSize: 17 }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: theme.muted,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  {item.code}
                </Text>
              </View>
              {item.code === value ? (
                <Text
                  accessibilityLabel="Selected"
                  style={{
                    color: theme.primary,
                    fontSize: 19,
                    fontWeight: "600",
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View
            style={{
              margin: 16,
              padding: 16,
              gap: 4,
              borderRadius: 16,
              backgroundColor: theme.surface,
            }}
          >
            <Text
              style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}
            >
              No currencies found
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14 }}>
              {`No currencies match “${query}”.`}
            </Text>
          </View>
        }
      />
      <Stack.SearchBar
        placeholder="Search"
        placement="stacked"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery("")}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Close currency selector"
          onPress={close}
        >
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
