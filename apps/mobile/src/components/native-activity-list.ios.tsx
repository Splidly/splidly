import { Host, RNHostView, VStack } from "@expo/ui/swift-ui";
import { requireNativeView } from "expo";
import { useState, type ReactNode } from "react";
import { Text, View, type NativeSyntheticEvent } from "react-native";
import { spacing, useTheme } from "../theme";
import type { NativeActivityListProps } from "./native-activity-list.types";

type NativeSection = {
  key: string;
  isOverview: boolean;
  headerIndex: number;
  headerHeight: number;
  rows: {
    key: string;
    childIndex: number;
    canDelete: boolean;
    deletionDisabled: boolean;
    height: number;
  }[];
  footerIndex?: number;
  footerHeight?: number;
};
type SwipeResult = { requestId: string; deleted: boolean };
type NativeListProps = {
  children: ReactNode;
  sections: NativeSection[];
  completion?: SwipeResult | undefined;
  refreshCompletion?: string | undefined;
  refreshEnabled: boolean;
  bounces: boolean;
  onDeleteRequested: (
    event: NativeSyntheticEvent<{ rowKey: string; requestId: string }>,
  ) => Promise<void>;
  onHostedLayout: (
    event: NativeSyntheticEvent<{ key: string; width: number }>,
  ) => void;
  onRefresh: (
    event: NativeSyntheticEvent<{ requestId: string }>,
  ) => Promise<void>;
  onScroll: NativeActivityListProps["scrollProps"]["onScroll"];
  testID: string;
};
const ActivityListView = requireNativeView<NativeListProps>(
  "SplidlySwipe",
  "ActivityListView",
);

// UIKit owns the list, its swipe gestures, destructive animation, and the
// completion callback that keeps a swipe pending during confirmation.
export function NativeActivityList({
  sections,
  header,
  footer,
  scrollProps,
}: NativeActivityListProps) {
  const theme = useTheme();
  const [completion, setCompletion] = useState<SwipeResult>();
  const [refreshCompletion, setRefreshCompletion] = useState<string>();
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [heights, setHeights] = useState<Record<string, number>>({});
  const children: ReactNode[] = [];
  function host(key: string, content: ReactNode, testID: string) {
    // Date headers share the native section width. This also lets Yoga measure
    // offscreen date labels before UIKit creates their supplementary views.
    const width =
      widths[key] ??
      (key.startsWith("header:") ? widths["header:overview"] : undefined);
    const index = children.length;
    children.push(
      <Host
        key={key}
        matchContents={{ vertical: true }}
        ignoreSafeArea="all"
        style={{ width }}
      >
        <RNHostView matchContents>
          <View
            testID={testID}
            style={{ width, gap: spacing.lg }}
            onLayout={({
              nativeEvent: {
                layout: { height },
              },
            }) => {
              if (width !== undefined && height > 0) {
                setHeights((current) =>
                  current[key] === height
                    ? current
                    : { ...current, [key]: height },
                );
              }
            }}
          >
            {content}
          </View>
        </RNHostView>
      </Host>,
    );
    return index;
  }
  const nativeSections: NativeSection[] = [
    {
      key: "overview",
      isOverview: true,
      headerIndex: host(
        "header:overview",
        header,
        "native-activity-header-content",
      ),
      headerHeight: heights["header:overview"] ?? 0,
      rows: [],
    },
    ...sections.map((section) => {
      const headerKey = `header:${section.key}`;
      const headerIndex = host(
        headerKey,
        <>
          {section.label ? (
            <View
              testID={`activity-date-${section.key}`}
              style={{
                paddingHorizontal: spacing.md,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              <Text
                selectable={false}
                testID={`activity-date-label-${section.key}`}
                style={{ color: theme.muted, fontSize: 14, fontWeight: "600" }}
              >
                {section.label}
              </Text>
            </View>
          ) : null}
        </>,
        `native-activity-header-${section.key}`,
      );
      const rows = section.data.map((row) => {
        const childIndex = row.onDelete
          ? children.push(
              <VStack key={row.key} alignment="leading" spacing={0}>
                {row.content}
              </VStack>,
            ) - 1
          : host(
              `row:${row.key}`,
              row.content,
              `native-activity-row-${row.key}`,
            );
        return {
          key: row.key,
          childIndex,
          canDelete: !!row.onDelete,
          deletionDisabled: row.deletionDisabled ?? false,
          height: heights[`row:${row.key}`] ?? 0,
        };
      });
      return {
        key: section.key,
        isOverview: false,
        headerIndex,
        headerHeight: heights[headerKey] ?? 0,
        rows,
      };
    }),
  ];
  const lastSection = nativeSections.at(-1)!;
  if (footer) {
    const key = `footer:${lastSection.key}`;
    lastSection.footerIndex = host(
      key,
      footer,
      "native-activity-footer-content",
    );
    lastSection.footerHeight = heights[key] ?? 0;
  }

  return (
    <Host style={scrollProps.style}>
      <ActivityListView
        testID="native-activity-list"
        sections={nativeSections}
        completion={completion}
        refreshCompletion={refreshCompletion}
        refreshEnabled={!!scrollProps.onRefresh}
        bounces={scrollProps.bounces !== false}
        onScroll={scrollProps.onScroll}
        onHostedLayout={({ nativeEvent: { key, width } }) => {
          if (width > 0) {
            setWidths((current) =>
              current[key] === width ? current : { ...current, [key]: width },
            );
          }
        }}
        onRefresh={async ({ nativeEvent: { requestId } }) => {
          try {
            await scrollProps.onRefresh?.();
          } finally {
            setRefreshCompletion(requestId);
          }
        }}
        onDeleteRequested={async ({ nativeEvent: { rowKey, requestId } }) => {
          let deleted = false;
          try {
            const row = sections
              .flatMap((section) => section.data)
              .find((row) => row.key === rowKey);
            if (row && !row.deletionDisabled) {
              deleted = (await row.onDelete?.().catch(() => false)) === true;
            }
          } finally {
            setCompletion({ requestId, deleted });
          }
        }}
      >
        {children}
      </ActivityListView>
    </Host>
  );
}
