import { Host, RNHostView, VStack } from "@expo/ui/swift-ui";
import { requireNativeView } from "expo";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Text, View, type NativeSyntheticEvent } from "react-native";
import { friendlyErrorMessage } from "../lib/network";
import { spacing, useTheme } from "../theme";
import type { ActivityPreview, NativeActivityListProps, NativeSettingsRow } from "./native-activity-list.types";

type NativeSection = {
  key: string;
  isOverview: boolean;
  headerIndex: number;
  headerHeight: number;
  headerTitle?: string;
  footerTitle?: string;
  rows: {
    key: string;
    childIndex: number;
    canDelete: boolean;
    nativeContent: boolean;
    selectable: boolean;
    settings?: NativeSettingsRow;
    actionTitle: string;
    actionIcon: string;
    actionColor?: string;
    deletionDisabled: boolean;
    height: number;
    preview?: ActivityPreview;
    previewActions: { id: string; title: string; symbol: string; destructive: boolean; disabled: boolean }[];
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
  plain: boolean;
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
  onRowPress: (event: NativeSyntheticEvent<{ rowKey: string }>) => void;
  onPreviewOpen: (event: NativeSyntheticEvent<{ rowKey: string }>) => void;
  onPreviewAction: (event: NativeSyntheticEvent<{ rowKey: string; actionId: string }>) => Promise<void>;
  testID: string;
};
const ActivityListView = requireNativeView<NativeListProps>(
  "SplidlySwipe",
  "ActivityListView",
);

// UIKit owns the list, its swipe gestures, destructive animation, and the
// completion callback that keeps a swipe pending during confirmation.
export function NativeActivityList({
  appearance = "grouped",
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
  const previewActionPending = useRef(false);
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
              if (width !== undefined && height >= 0) {
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
      // An empty overview is a valid measured header. Keep it distinct from
      // an overview whose width and height have not arrived yet.
      headerHeight: heights["header:overview"] ?? -1,
      rows: [],
    },
    ...sections.map((section, sectionIndex) => {
      const headerKey = `header:${section.key}`;
      const headerIndex = host(
        headerKey,
        <>
          {section.label && !section.nativeHeader ? (
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
        const childIndex = row.onDelete || row.nativeContent
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
          nativeContent: row.nativeContent ?? false,
          selectable: typeof row.onPress === "function",
          ...(row.settings ? { settings: row.settings } : {}),
          actionTitle: row.actionTitle ?? "Delete",
          actionIcon: row.actionIcon ?? "trash",
          ...(row.actionColor ? { actionColor: row.actionColor } : {}),
          deletionDisabled: row.deletionDisabled ?? false,
          height: heights[`row:${row.key}`] ?? 0,
          ...(row.preview && row.onPreviewOpen ? { preview: row.preview } : {}),
          previewActions: (row.previewActions ?? []).map((action) => ({
            id: action.id,
            title: action.title,
            symbol: action.symbol,
            destructive: action.destructive ?? false,
            disabled: action.disabled ?? false,
          })),
        };
      });
      const footerKey = `footer:${section.key}`;
      const isLast = sectionIndex === sections.length - 1;
      const sectionFooter = section.footer || (isLast && footer)
        ? <>{section.footer}{isLast ? footer : null}</>
        : null;
      return {
        key: section.key,
        isOverview: false,
        headerIndex,
        headerHeight: heights[headerKey] ?? 0,
        ...(section.nativeHeader ? { headerTitle: section.label } : {}),
        ...(section.nativeFooter ? { footerTitle: section.nativeFooter } : {}),
        rows,
        ...(sectionFooter ? {
          footerIndex: host(footerKey, sectionFooter, isLast && footer ? "native-activity-footer-content" : `native-activity-footer-${section.key}`),
          footerHeight: heights[footerKey] ?? 0,
        } : {}),
      };
    }),
  ];
  const lastSection = nativeSections.at(-1)!;
  if (footer && sections.length === 0) {
    const key = `footer:${lastSection.key}`;
    lastSection.footerIndex = host(
      key,
      footer,
      "native-activity-footer-content",
    );
    lastSection.footerHeight = heights[key] ?? 0;
  }

  return (
    // UIKit owns automatic navigation insets. Let its collection view extend
    // behind the floating tab bar instead of clipping it at the safe-area edge.
    <Host style={scrollProps.style} ignoreSafeArea="container">
      <ActivityListView
        testID="native-activity-list"
        plain={appearance === "plain"}
        sections={nativeSections}
        completion={completion}
        refreshCompletion={refreshCompletion}
        refreshEnabled={!!scrollProps.onRefresh}
        bounces={scrollProps.bounces !== false}
        onScroll={scrollProps.onScroll}
        onRowPress={({ nativeEvent: { rowKey } }) => {
          if (previewActionPending.current) return;
          sections.flatMap((section) => section.data)
            .find((row) => row.key === rowKey)?.onPress?.();
        }}
        onPreviewOpen={({ nativeEvent: { rowKey } }) => {
          if (previewActionPending.current) return;
          sections.flatMap((section) => section.data)
            .find((row) => row.key === rowKey && row.preview)?.onPreviewOpen?.();
        }}
        onPreviewAction={async ({ nativeEvent: { rowKey, actionId } }) => {
          if (previewActionPending.current) return;
          const row = sections.flatMap((section) => section.data)
            .find((row) => row.key === rowKey && row.preview);
          const action = row?.previewActions?.find((item) => item.id === actionId);
          if (!action || action.disabled) return;
          previewActionPending.current = true;
          try {
            await action.onPress();
          } catch (cause) {
            Alert.alert("Could not complete action", friendlyErrorMessage(cause));
          } finally {
            previewActionPending.current = false;
          }
        }}
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
