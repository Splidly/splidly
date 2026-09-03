import type { CurrencyCode } from "@splidly/shared";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderButton } from "../components/ui";
import {
  CurrencyNativeList,
  type CurrencySection,
} from "../components/currency-native-list";
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
import { toolbarIcons } from "../lib/toolbar-icons";

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
      <CurrencyNativeList
        sections={sections}
        value={value}
        query={query}
        onQueryChange={setQuery}
        onSelect={select}
      />
      <Stack.Screen
        options={{
          title: "Currency",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton
                label="Close currency selector"
                glyph="×"
                onPress={close}
              />
            ),
          }),
        }}
      />
      {process.env.EXPO_OS === "ios" ? (
        <Stack.SearchBar
          placeholder="Search currencies"
          placement="stacked"
          autoCapitalize="none"
          hideWhenScrolling={false}
          onChangeText={(event) => setQuery(event.nativeEvent.text)}
          onCancelButtonPress={() => setQuery("")}
        />
      ) : null}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={toolbarIcons.close}
          accessibilityLabel="Close currency selector"
          onPress={close}
        />
      </Stack.Toolbar>
    </>
  );
}
