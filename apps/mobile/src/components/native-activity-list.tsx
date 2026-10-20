import { SectionList, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";
import { NativeExpenseSwipe } from "./native-expense-swipe";
import type { NativeActivityListProps } from "./native-activity-list.types";

export function NativeActivityList({
  appearance = "grouped",
  sections,
  header,
  footer,
  scrollProps,
}: NativeActivityListProps) {
  const theme = useTheme();
  const plain = appearance === "plain";
  return (
    <SectionList
      {...scrollProps}
      sections={sections}
      keyExtractor={(row) => row.key}
      stickySectionHeadersEnabled={false}
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      windowSize={7}
      ListHeaderComponent={
        <View
          style={{
            gap: spacing.lg,
            ...(plain ? { paddingHorizontal: spacing.md } : {}),
          }}
        >
          {header}
        </View>
      }
      ListFooterComponent={
        footer ? (
          <View
            style={{
              marginTop: spacing.lg,
              ...(plain ? { paddingHorizontal: spacing.md } : {}),
            }}
          >
            {footer}
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => plain && !section.label ? null : (
        <View testID={`activity-date-${section.key}`}>
          <Text
            selectable={false}
            testID={`activity-date-label-${section.key}`}
            style={{
              color: theme.muted,
              fontSize: 14,
              fontWeight: "600",
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
            }}
          >
            {section.label}
          </Text>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={{
            backgroundColor: plain ? "transparent" : theme.surface,
            borderTopWidth: plain || index === 0 ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            overflow: "hidden",
            borderTopLeftRadius: !plain && index === 0 ? 16 : 0,
            borderTopRightRadius: !plain && index === 0 ? 16 : 0,
            borderBottomLeftRadius:
              !plain && index === section.data.length - 1 ? 16 : 0,
            borderBottomRightRadius:
              !plain && index === section.data.length - 1 ? 16 : 0,
          }}
        >
          {plain && index > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 94,
                right: 16,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              }}
            />
          ) : null}
          <NativeExpenseSwipe row={item}>{item.content}</NativeExpenseSwipe>
        </View>
      )}
    />
  );
}
