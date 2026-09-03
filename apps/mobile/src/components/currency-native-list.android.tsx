import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { currencySymbolWithCode } from "../lib/money-display";
import { useTheme } from "../theme";
import type {
  CurrencyNativeListProps,
  CurrencySection,
} from "./currency-native-list.types";

export type { CurrencySection };

export function CurrencyNativeList({
  sections,
  value,
  query,
  onQueryChange,
  onSelect,
}: CurrencyNativeListProps) {
  const theme = useTheme();

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: theme.background }}
      sections={sections}
      keyExtractor={(currency) => currency.code}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={32}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <View
          style={[styles.searchContainer, { backgroundColor: theme.background }]}
        >
          <View
            style={[styles.searchField, { backgroundColor: theme.elevated }]}
          >
            <TextInput
              accessibilityLabel="Search currencies"
              value={query}
              placeholder="Search currencies"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onChangeText={onQueryChange}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear currency search"
                hitSlop={8}
                onPress={() => onQueryChange("")}
                style={({ pressed }) => [
                  styles.clearButton,
                  { opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <Text
                  selectable={false}
                  style={[styles.clearGlyph, { color: theme.muted }]}
                >
                  ×
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text
          selectable={false}
          style={[
            styles.sectionHeader,
            { color: theme.muted, backgroundColor: theme.background },
          ]}
        >
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => {
        const selected = item.code === value;
        return (
          <Pressable
            testID={`currency-${item.code}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.name}, ${item.code}`}
            android_ripple={{ color: theme.elevated }}
            onPress={() => onSelect(item.code)}
            style={[
              styles.row,
              {
                backgroundColor: theme.sheet,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={styles.rowCopy}>
              <Text
                selectable={false}
                numberOfLines={1}
                style={[styles.currencyName, { color: theme.text }]}
              >
                {item.name}
              </Text>
              <Text
                selectable={false}
                style={[styles.currencyCode, { color: theme.muted }]}
              >
                {currencySymbolWithCode(item.code)}
              </Text>
            </View>
            {selected ? (
              <View
                accessible={false}
                style={[
                  styles.checkmarkContainer,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text selectable={false} style={styles.checkmark}>
                  ✓
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text
            selectable={false}
            style={[styles.emptyStateTitle, { color: theme.text }]}
          >
            No currencies found
          </Text>
          <Text
            selectable={false}
            style={[styles.emptyStateBody, { color: theme.muted }]}
          >
            {`No currencies match “${query}”.`}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchField: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 56,
    paddingVertical: 0,
    fontSize: 16,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clearGlyph: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "400",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: "500",
  },
  currencyCode: {
    fontSize: 13,
    fontWeight: "500",
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
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
