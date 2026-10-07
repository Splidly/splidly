import { SectionList, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";
import { NativeExpenseSwipe } from "./native-expense-swipe";
import type { NativeActivityListProps } from "./native-activity-list.types";

export function NativeActivityList({
  sections,
  header,
  footer,
  scrollProps,
}: NativeActivityListProps) {
  const theme = useTheme();
  return (
    <SectionList
      {...scrollProps}
      sections={sections}
      keyExtractor={(row) => row.key}
      stickySectionHeadersEnabled={false}
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      windowSize={7}
      ListHeaderComponent={<View style={{ gap: spacing.lg }}>{header}</View>}
      ListFooterComponent={
        footer ? <View style={{ marginTop: spacing.lg }}>{footer}</View> : null
      }
      renderSectionHeader={({ section }) => (
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
            backgroundColor: theme.surface,
            borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            overflow: "hidden",
            borderTopLeftRadius: index === 0 ? 16 : 0,
            borderTopRightRadius: index === 0 ? 16 : 0,
            borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0,
            borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0,
          }}
        >
          <NativeExpenseSwipe row={item}>{item.content}</NativeExpenseSwipe>
        </View>
      )}
    />
  );
}
