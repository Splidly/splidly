import { Host, Icon } from "@expo/ui";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { currencySymbolWithCode } from "../lib/money-display";
import type {
  CurrencyNativeListProps,
  CurrencySection,
} from "./currency-native-list.types";

const CHECK_ICON = Icon.select({
  ios: "checkmark",
  android: import("@expo/material-symbols/check.xml"),
});

export type { CurrencySection };

export function CurrencyNativeList({
  sections,
  value,
  query,
  onQueryChange: _onQueryChange,
  onSelect,
}: CurrencyNativeListProps) {
  const theme = useTheme();

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: theme.sheet }}
      sections={sections}
      keyExtractor={(currency) => currency.code}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      initialNumToRender={18}
      maxToRenderPerBatch={14}
      updateCellsBatchingPeriod={24}
      windowSize={7}
      renderSectionHeader={({ section }) => (
        <Text
          style={[
            styles.sectionHeader,
            {
              color: theme.muted,
              backgroundColor: theme.sheet,
            },
          ]}
        >
          {section.title}
        </Text>
      )}
      renderItem={({ item, index, section }) => {
        const last = index === section.data.length - 1;
        return (
          <Pressable
            testID={`currency-${item.code}`}
            accessibilityRole="button"
            accessibilityState={{ selected: item.code === value }}
            accessibilityLabel={`${item.name}, ${item.code}`}
            onPress={() => onSelect(item.code)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.elevated : theme.sheet,
              },
            ]}
          >
            <View
              style={[
                styles.rowContent,
                !last && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <View style={styles.rowCopy}>
                <Text
                  numberOfLines={1}
                  style={[styles.currencyName, { color: theme.text }]}
                >
                  {item.name}
                </Text>
                <Text style={[styles.currencyCode, { color: theme.muted }]}>
                  {currencySymbolWithCode(item.code)}
                </Text>
              </View>
              {item.code === value ? (
                <Host
                  matchContents
                  ignoreSafeArea="all"
                  style={styles.checkmark}
                >
                  <Icon
                    name={CHECK_ICON}
                    size={20}
                    color={theme.primary}
                    accessibilityLabel="Selected"
                  />
                </Host>
              ) : null}
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text
            style={[styles.emptyStateTitle, { color: theme.text }]}
          >
            No currencies found
          </Text>
          <Text style={[styles.emptyStateBody, { color: theme.muted }]}>
            {`No currencies match “${query}”.`}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 7,
  },
  row: {
    minHeight: 56,
    paddingLeft: 20,
  },
  rowContent: {
    flex: 1,
    minHeight: 56,
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  currencyName: {
    fontSize: 17,
  },
  currencyCode: {
    fontSize: 13,
    fontWeight: "500",
  },
  checkmark: {
    width: 20,
    height: 20,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 4,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptyStateBody: {
    fontSize: 14,
  },
});
