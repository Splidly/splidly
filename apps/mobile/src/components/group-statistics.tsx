import type { CurrencyCode, ExpenseIconKey, Money } from "@splidly/shared";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { semanticChartColorFor } from "../lib/avatar-colors";
import { formatConvertedMoney } from "../lib/money-display";
import { normalizeGroupColor } from "../lib/group-colors";
import { useTheme } from "../theme";
import { Avatar } from "./ui";
import { ExpenseIcon, expenseIconLabel } from "./expense-icon";

export type StatisticsRange = "all" | "12-months" | "30-days" | "custom";
export type StatisticsTimelineBucket = "day" | "week" | "month" | "year";

export type StatisticsRangeSelection = {
  range: StatisticsRange;
  from?: Date;
  to?: Date;
};

export type GroupStatisticsData = {
  group: {
    id: string;
    name: string;
    color: string;
    currency: CurrencyCode;
  };
  unconvertedExpenseCount: number;
  totalSpent: Money;
  viewerPaid: Money;
  viewerShare: Money;
  expenseCount: number;
  rangeStart: Date;
  rangeEnd: Date;
  timelineBucket: StatisticsTimelineBucket;
  categories: {
    iconKey: ExpenseIconKey;
    amount: Money;
  }[];
  timeline: {
    period: string;
    amount: Money;
  }[];
  members: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    homeCurrency: CurrencyCode;
    isViewer: boolean;
    paid: Money;
    share: Money;
  }[];
  expenses: {
    id: string;
    description: string;
    iconKey: ExpenseIconKey;
    occurredAt: Date;
    amount: Money;
    sourceAmount: Money;
    payments: {
      userId: string;
      amount: Money;
      sourceAmount: Money;
      homeAmount?: Money;
    }[];
    shares: {
      userId: string;
      amount: Money;
      sourceAmount: Money;
      homeAmount?: Money;
    }[];
  }[];
};

const quickRanges: readonly {
  value: Exclude<StatisticsRange, "custom">;
  label: string;
}[] = [
  { value: "30-days", label: "30 days" },
  { value: "12-months", label: "1 year" },
  { value: "all", label: "All time" },
];

const quickRangeDetails: Record<Exclude<StatisticsRange, "custom">, string> = {
  "30-days": "Recent",
  "12-months": "Trends",
  all: "Everything",
};

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function defaultCustomRange() {
  const today = new Date();
  return {
    from: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: endOfDay(today),
  };
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" as const }),
  }).format(date);
}

function CalendarGlyph({ color }: { color: string }) {
  return (
    <View style={[styles.calendarGlyph, { borderColor: color }]}>
      <View style={[styles.calendarGlyphBar, { backgroundColor: color }]} />
      <View style={styles.calendarGlyphDots}>
        {[0, 1, 2, 3].map((dot) => (
          <View
            key={dot}
            style={[styles.calendarGlyphDot, { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

function RangeSelector({
  selection,
  onSelectionChange,
}: {
  selection: StatisticsRangeSelection;
  onSelectionChange: (selection: StatisticsRangeSelection) => void;
}) {
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<"from" | "to">();
  const [draft, setDraft] = useState(() => defaultCustomRange());
  const isIOS = process.env.EXPO_OS === "ios";

  const openEditor = () => {
    setDraft(
      selection.range === "custom" && selection.from && selection.to
        ? { from: selection.from, to: selection.to }
        : defaultCustomRange(),
    );
    setActiveBoundary(undefined);
    setEditorOpen(true);
  };
  const customLabel =
    selection.range === "custom" && selection.from && selection.to
      ? `${shortDate(selection.from)} – ${shortDate(selection.to)}`
      : "Custom";
  const updateBoundary = (boundary: "from" | "to", date: Date) => {
    setDraft((current) => {
      if (boundary === "from") {
        const from = startOfDay(date);
        return {
          from,
          to: from > current.to ? endOfDay(date) : current.to,
        };
      }
      const to = endOfDay(date);
      return {
        from: to < current.from ? startOfDay(date) : current.from,
        to,
      };
    });
  };
  const selectedQuickRange = quickRanges.find(
    (range) => range.value === selection.range,
  );

  return (
    <View
      style={[
        styles.rangeControl,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.rangeHeading}>
        <View style={styles.rangeHeadingCopy}>
          <Text
            selectable={false}
            style={[styles.rangeEyebrow, { color: theme.muted }]}
          >
            TIME PERIOD
          </Text>
          <Text
            selectable={false}
            numberOfLines={1}
            style={[styles.rangeCurrent, { color: theme.text }]}
          >
            {editorOpen
              ? "Choose a date range"
              : selectedQuickRange?.label ?? customLabel}
          </Text>
        </View>
        <View
          style={[styles.rangeStatusDot, { backgroundColor: theme.primary }]}
        />
      </View>

      {!editorOpen ? (
        <>
          <View accessibilityRole="tablist" style={styles.quickRangeRow}>
            {quickRanges.map((option) => {
              const selected = selection.range === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`statistics-range-${option.value}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectionChange({ range: option.value })}
                  style={({ pressed }) => [
                    styles.quickRange,
                    {
                      backgroundColor: selected
                        ? theme.primary
                        : theme.elevated,
                      opacity: pressed ? 0.68 : 1,
                    },
                  ]}
                >
                  <Text
                    selectable={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    style={[
                      styles.quickRangeText,
                      { color: selected ? theme.primaryText : theme.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    selectable={false}
                    numberOfLines={1}
                    style={[
                      styles.quickRangeDetail,
                      { color: selected ? theme.primaryText : theme.muted },
                    ]}
                  >
                    {quickRangeDetails[option.value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            testID="statistics-range-custom"
            accessibilityRole="button"
            accessibilityState={{ selected: selection.range === "custom" }}
            accessibilityLabel={
              selection.range === "custom"
                ? `Custom range, ${customLabel}`
                : "Choose custom date range"
            }
            onPress={openEditor}
            style={({ pressed }) => [
              styles.customRange,
              {
                backgroundColor: theme.elevated,
                borderColor:
                  selection.range === "custom" ? theme.primary : "transparent",
                opacity: pressed ? 0.68 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.calendarGlyphWrap,
                {
                  backgroundColor:
                    selection.range === "custom" ? theme.primary : theme.surface,
                },
              ]}
            >
              <CalendarGlyph
                color={String(
                  selection.range === "custom"
                    ? theme.primaryText
                    : theme.primary,
                )}
              />
            </View>
            <View style={styles.customRangeCopy}>
              <Text
                selectable={false}
                style={[styles.customRangeTitle, { color: theme.text }]}
              >
                {selection.range === "custom" ? "Custom dates" : "Choose dates"}
              </Text>
              <Text
                selectable={false}
                numberOfLines={1}
                style={[styles.customRangeValue, { color: theme.muted }]}
              >
                {selection.range === "custom"
                  ? customLabel
                  : "Pick an exact start and end"}
              </Text>
            </View>
            <Text
              selectable={false}
              accessibilityElementsHidden
              style={[styles.customRangeChevron, { color: theme.subtle }]}
            >
              ›
            </Text>
          </Pressable>
        </>
      ) : null}

      {editorOpen ? (
        <View testID="statistics-custom-range-editor" style={styles.rangeEditor}>
          <View style={styles.dateBoundaryRow}>
            {(["from", "to"] as const).map((boundary) => {
              const selected = activeBoundary === boundary;
              return (
                <View key={boundary} style={styles.dateBoundaryLine}>
                  <View style={styles.dateTimeline}>
                    <View
                      style={[
                        styles.dateTimelineDot,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                    {boundary === "from" ? (
                      <View
                        style={[
                          styles.dateTimelineStem,
                          { backgroundColor: theme.border },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Pressable
                    testID={`statistics-custom-${boundary}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${boundary === "from" ? "Start" : "End"} date, ${shortDate(draft[boundary])}`}
                    onPress={() => setActiveBoundary(boundary)}
                    style={({ pressed }) => [
                      styles.dateBoundary,
                      {
                        backgroundColor: theme.elevated,
                        borderColor: selected ? theme.primary : "transparent",
                        opacity: pressed ? 0.68 : 1,
                      },
                    ]}
                  >
                    <View style={styles.dateBoundaryCopy}>
                      <Text
                        selectable={false}
                        style={[
                          styles.dateBoundaryLabel,
                          { color: theme.muted },
                        ]}
                      >
                        {boundary === "from" ? "START DATE" : "END DATE"}
                      </Text>
                      <Text
                        selectable={false}
                        style={[styles.dateBoundaryValue, { color: theme.text }]}
                      >
                        {shortDate(draft[boundary])}
                      </Text>
                    </View>
                    <Text
                      selectable={false}
                      accessibilityElementsHidden
                      style={[styles.dateBoundaryChevron, { color: theme.subtle }]}
                    >
                      ›
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {activeBoundary ? (
            <DateTimePicker
              testID={
                isIOS
                  ? `statistics-custom-${activeBoundary}-picker`
                  : "statistics-custom-date-picker"
              }
              value={draft[activeBoundary]}
              mode="date"
              display={isIOS ? "inline" : "default"}
              presentation={isIOS ? "inline" : "dialog"}
              maximumDate={new Date()}
              accentColor={String(theme.primary)}
              onValueChange={(_, date) => {
                updateBoundary(activeBoundary, date);
                if (!isIOS) setActiveBoundary(undefined);
              }}
              onDismiss={() => setActiveBoundary(undefined)}
              style={isIOS ? styles.inlineDatePicker : undefined}
            />
          ) : null}

          <View style={styles.rangeActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEditorOpen(false)}
              style={styles.rangeAction}
            >
              <Text
                selectable={false}
                style={[styles.rangeActionText, { color: theme.muted }]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              testID="statistics-custom-apply"
              accessibilityRole="button"
              onPress={() => {
                onSelectionChange({ range: "custom", ...draft });
                setEditorOpen(false);
              }}
              style={({ pressed }) => [
                styles.rangeAction,
                styles.rangeApply,
                {
                  backgroundColor: theme.primary,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text
                selectable={false}
                style={[
                  styles.rangeActionText,
                  { color: theme.primaryText },
                ]}
              >
                Apply dates
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatted(money: Money) {
  return formatConvertedMoney(
    BigInt(money.minor),
    money.currency as CurrencyCode,
  );
}

function formattedMinor(amountMinor: bigint, currency: CurrencyCode) {
  return formatConvertedMoney(amountMinor, currency);
}

function percent(amountMinor: bigint, totalMinor: bigint) {
  if (totalMinor <= 0n) return 0;
  return Number((amountMinor * 100n + totalMinor / 2n) / totalMinor);
}

function proportionalWidth(amountMinor: bigint, maximumMinor: bigint) {
  if (amountMinor <= 0n || maximumMinor <= 0n) return 0;
  return Math.max(3, Number((amountMinor * 100n) / maximumMinor));
}

export function statisticsCategoryLabel(iconKey: ExpenseIconKey) {
  return iconKey === "other" ? "Uncategorized" : expenseIconLabel(iconKey);
}

function periodDate(period: string, bucket: StatisticsTimelineBucket) {
  return new Date(
    bucket === "year"
      ? `${period}-01-01T12:00:00.000Z`
      : bucket === "month"
        ? `${period}-01T12:00:00.000Z`
        : `${period}T12:00:00.000Z`,
  );
}

function periodLabel(
  period: string,
  bucket: StatisticsTimelineBucket,
  detailed = false,
) {
  if (bucket === "year") return period;
  const date = periodDate(period, bucket);
  if (Number.isNaN(date.getTime())) return period;
  if (bucket === "month") {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      ...(detailed ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    }).format(date);
  }
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    ...(detailed ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    ...(detailed ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(date);
  return bucket === "week" && detailed ? `Week of ${dateLabel}` : dateLabel;
}

function bucketStart(date: Date, bucket: StatisticsTimelineBucket) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (bucket === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  }
  if (bucket === "month") start.setUTCDate(1);
  if (bucket === "year") {
    start.setUTCMonth(0, 1);
  }
  return start;
}

function bucketKey(date: Date, bucket: StatisticsTimelineBucket) {
  if (bucket === "year") return date.toISOString().slice(0, 4);
  if (bucket === "month") return date.toISOString().slice(0, 7);
  return date.toISOString().slice(0, 10);
}

function nextBucket(date: Date, bucket: StatisticsTimelineBucket) {
  const next = new Date(date);
  if (bucket === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (bucket === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (bucket === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  if (bucket === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function completeTimeline(data: GroupStatisticsData) {
  const points = new Map(data.timeline.map((point) => [point.period, point]));
  const completed: GroupStatisticsData["timeline"] = [];
  const last = bucketStart(new Date(data.rangeEnd), data.timelineBucket);
  let current = bucketStart(new Date(data.rangeStart), data.timelineBucket);
  let safety = 0;
  while (current <= last && safety < 200) {
    const period = bucketKey(current, data.timelineBucket);
    completed.push(
      points.get(period) ?? {
        period,
        amount: { currency: data.group.currency, minor: "0" },
      },
    );
    current = nextBucket(current, data.timelineBucket);
    safety += 1;
  }
  return completed;
}

function timelineBucketLabel(bucket: StatisticsTimelineBucket) {
  switch (bucket) {
    case "day":
      return "Daily totals";
    case "week":
      return "Weekly totals";
    case "month":
      return "Monthly totals";
    case "year":
      return "Yearly totals";
  }
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeading}>
        <Text selectable={false} style={[styles.sectionTitle, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            selectable={false}
            style={[styles.sectionSubtitle, { color: theme.muted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {children}
      </View>
    </View>
  );
}

function PersonalOverview({
  data,
  accent,
}: {
  data: GroupStatisticsData;
  accent: string;
}) {
  const theme = useTheme();
  const totalMinor = BigInt(data.totalSpent.minor);
  const shareMinor = BigInt(data.viewerShare.minor);
  const paidMinor = BigInt(data.viewerPaid.minor);
  const restMinor = totalMinor > shareMinor ? totalMinor - shareMinor : 0n;
  const differenceMinor = paidMinor - shareMinor;
  const differenceCopy =
    differenceMinor > 0n
      ? `${formattedMinor(differenceMinor, data.group.currency)} more than your share`
      : differenceMinor < 0n
        ? `${formattedMinor(-differenceMinor, data.group.currency)} less than your share`
        : "Exactly matches your share";

  return (
    <View
      testID="statistics-hero"
      style={[
        styles.hero,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.06)",
        },
      ]}
    >
      <View style={styles.heroHeading}>
        <View style={[styles.heroAccent, { backgroundColor: accent }]} />
        <Text selectable={false} style={[styles.heroLabel, { color: theme.muted }]}>
          Your share
        </Text>
      </View>
      <Text
        selectable={false}
        style={[styles.heroValue, { color: theme.text }]}
      >
        {formatted(data.viewerShare)}
      </Text>
      <Text selectable={false} style={[styles.heroContext, { color: theme.muted }]}>
        {percent(shareMinor, totalMinor)}% of {formatted(data.totalSpent)} total
      </Text>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Your share is ${formatted(data.viewerShare)}. The rest of the group is ${formattedMinor(restMinor, data.group.currency)}.`}
        style={[styles.shareTrack, { backgroundColor: theme.elevated }]}
      >
        <View
          testID="viewer-share-segment"
          style={[
            styles.shareFill,
            {
              backgroundColor: accent,
              width: `${Math.min(100, percent(shareMinor, totalMinor))}%`,
            },
          ]}
        />
      </View>
      <View style={styles.shareLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: accent }]} />
          <Text selectable={false} style={[styles.legendText, { color: theme.muted }]}>
            You · {formatted(data.viewerShare)}
          </Text>
        </View>
        <Text selectable={false} style={[styles.legendText, { color: theme.muted }]}>
          Others · {formattedMinor(restMinor, data.group.currency)}
        </Text>
      </View>

      <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />

      <View testID="viewer-payment-summary" style={styles.paymentSummary}>
        <View style={styles.paymentAmount}>
          <Text
            selectable={false}
            style={[styles.paymentLabel, { color: theme.muted }]}
          >
            You paid
          </Text>
          <Text
            selectable={false}
            style={[styles.paymentValue, { color: theme.text }]}
          >
            {formatted(data.viewerPaid)}
          </Text>
        </View>
        <Text
          selectable={false}
          style={[
            styles.paymentDifference,
            {
              color:
                differenceMinor > 0n
                  ? theme.positive
                  : differenceMinor < 0n
                    ? theme.negative
                    : theme.muted,
            },
          ]}
        >
          {differenceCopy}
        </Text>
      </View>
    </View>
  );
}

function TimelineChart({
  data,
  accent,
}: {
  data: GroupStatisticsData;
  accent: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const completedData = useMemo(() => completeTimeline(data), [data]);
  const rangeKey = `${new Date(data.rangeStart).getTime()}:${new Date(data.rangeEnd).getTime()}:${data.timelineBucket}`;
  const [selectionState, setSelectionState] = useState<{
    rangeKey: string;
    period: string;
  }>();
  const selectedPeriod =
    selectionState?.rangeKey === rangeKey ? selectionState.period : undefined;
  const maximum = completedData.reduce((current, point) => {
    const value = BigInt(point.amount.minor);
    return value > current ? value : current;
  }, 0n);
  const peak = completedData.find(
    (point) => BigInt(point.amount.minor) === maximum,
  );
  const selected = completedData.find(
    (point) => point.period === selectedPeriod,
  );
  const highlighted = selected ?? peak;
  const columnWidth = Math.max(
    44,
    Math.floor((width - 80) / Math.max(1, Math.min(completedData.length, 8))),
  );

  if (completedData.length === 0) {
    return (
      <Text selectable={false} style={[styles.emptyCopy, { color: theme.muted }]}>
        Spending trends will appear after the first expense.
      </Text>
    );
  }

  return (
    <View style={styles.timelineContent}>
      {highlighted ? (
        <View style={styles.chartSummary}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: accent }]} />
            <Text selectable={false} style={[styles.summaryLabel, { color: theme.muted }]}>
              {selected ? "Selected total" : "Highest total"}
            </Text>
          </View>
          <Text selectable={false} style={[styles.summaryValue, { color: theme.text }]}>
            {periodLabel(highlighted.period, data.timelineBucket, true)} ·{" "}
            {formatted(highlighted.amount)}
          </Text>
        </View>
      ) : null}
      <Text
        selectable={false}
        style={[styles.chartInstruction, { color: theme.muted }]}
      >
        Tap a bar to see its exact total
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chart}
      >
        {completedData.map((point) => {
          const amount = BigInt(point.amount.minor);
          const height = proportionalWidth(amount, maximum);
          const isPeak = amount === maximum;
          const isSelected = point.period === selectedPeriod;
          const isHighlighted = selectedPeriod ? isSelected : isPeak;
          return (
            <Pressable
              key={point.period}
              testID={`timeline-bar-${point.period}`}
              accessibilityRole="button"
              accessibilityLabel={`${periodLabel(point.period, data.timelineBucket, true)} total, ${formatted(point.amount)}`}
              accessibilityHint="Shows this total above the chart"
              onPress={() =>
                setSelectionState({ rangeKey, period: point.period })
              }
              style={[styles.chartColumn, { width: columnWidth }]}
            >
              <View style={styles.chartValueArea}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: amount === 0n ? 2 : `${height}%`,
                      backgroundColor: amount === 0n ? theme.border : accent,
                      opacity: isHighlighted ? 1 : selectedPeriod ? 0.24 : 0.42,
                    },
                  ]}
                />
              </View>
              <Text
                selectable={false}
                numberOfLines={1}
                style={[
                  styles.chartLabel,
                  { color: isHighlighted ? theme.text : theme.muted },
                  isHighlighted ? styles.chartLabelActive : null,
                ]}
              >
                {periodLabel(point.period, data.timelineBucket)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CategoryBreakdown({
  categories,
  totalMinor,
  onOpenCategory,
}: {
  categories: GroupStatisticsData["categories"];
  totalMinor: bigint;
  onOpenCategory?: (iconKey: ExpenseIconKey) => void;
}) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = categories.map((category) =>
    semanticChartColorFor(`expense:${category.iconKey}`, colorScheme),
  );

  return (
    <View style={styles.categoryContent}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Spending by category. ${categories
          .map(
            (category) =>
              `${statisticsCategoryLabel(category.iconKey)} ${percent(BigInt(category.amount.minor), totalMinor)} percent`,
          )
          .join(", ")}`}
        style={[styles.compositionBar, { backgroundColor: theme.elevated }]}
      >
        {categories.map((category, index) => (
          <View
            key={category.iconKey}
            testID={`category-segment-${category.iconKey}`}
            style={{
              backgroundColor: colors[index],
              width: `${percent(BigInt(category.amount.minor), totalMinor)}%`,
            }}
          />
        ))}
      </View>

      <View style={styles.rankedList}>
        {categories.map((category, index) => {
          const amountMinor = BigInt(category.amount.minor);
          const share = percent(amountMinor, totalMinor);
          const label = statisticsCategoryLabel(category.iconKey);
          const content = (
            <>
              <View style={styles.categoryIconWrap}>
                <View
                  style={[
                    styles.categoryColor,
                    { backgroundColor: colors[index] },
                  ]}
                />
                <ExpenseIcon
                  iconKey={category.iconKey}
                  name={label}
                  size={38}
                  useNameFallback={false}
                />
              </View>
              <View style={styles.rankCopy}>
                <View style={styles.rankLine}>
                  <Text
                    selectable={false}
                    numberOfLines={1}
                    style={[styles.rankName, { color: theme.text }]}
                  >
                    {label}
                  </Text>
                  <Text selectable={false} style={[styles.percent, { color: theme.muted }]}>
                    {share}%
                  </Text>
                  {onOpenCategory ? (
                    <Text
                      accessibilityElementsHidden
                      selectable={false}
                      style={[styles.disclosure, { color: theme.subtle }]}
                    >
                      ›
                    </Text>
                  ) : null}
                </View>
                <Text selectable={false} style={[styles.rankAmount, { color: theme.text }]}>
                  {formatted(category.amount)}
                </Text>
              </View>
            </>
          );
          return onOpenCategory ? (
            <Pressable
              key={category.iconKey}
              accessibilityRole="button"
              accessibilityLabel={`Show ${label} expenses`}
              onPress={() => onOpenCategory(category.iconKey)}
              style={({ pressed }) => [
                styles.categoryRow,
                { opacity: pressed ? 0.62 : 1 },
              ]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={category.iconKey} style={styles.categoryRow}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MemberShareCategoryOverview({
  data,
  member,
}: {
  data: GroupStatisticsData;
  member: GroupStatisticsData["members"][number];
}) {
  const categories = useMemo(() => {
    const totals = new Map<ExpenseIconKey, bigint>();
    for (const expense of data.expenses) {
      const share = expense.shares.find(
        (candidate) => candidate.userId === member.userId,
      );
      const amountMinor = share ? BigInt(share.amount.minor) : 0n;
      if (amountMinor <= 0n) continue;
      totals.set(
        expense.iconKey,
        (totals.get(expense.iconKey) ?? 0n) + amountMinor,
      );
    }
    return [...totals]
      .map(([iconKey, amountMinor]) => ({
        iconKey,
        amount: {
          currency: data.group.currency,
          minor: amountMinor.toString(),
        },
      }))
      .sort((left, right) => {
        const leftAmount = BigInt(left.amount.minor);
        const rightAmount = BigInt(right.amount.minor);
        return leftAmount === rightAmount ? 0 : leftAmount > rightAmount ? -1 : 1;
      });
  }, [data.expenses, data.group.currency, member.userId]);
  const totalMinor = categories.reduce(
    (sum, category) => sum + BigInt(category.amount.minor),
    0n,
  );

  if (categories.length === 0) return null;

  const possessiveName = member.isViewer ? "your" : `${member.displayName}'s`;
  return (
    <SectionCard
      title={`Where ${possessiveName} share went`}
      subtitle={`Only ${possessiveName} portion of each expense`}
    >
      <CategoryBreakdown
        categories={categories}
        totalMinor={totalMinor}
      />
    </SectionCard>
  );
}

function MemberMetric({
  member,
  metric,
  maximumMinor,
  color,
  onOpen,
}: {
  member: GroupStatisticsData["members"][number];
  metric: "paid" | "share";
  maximumMinor: bigint;
  color: string;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const amountMinor = BigInt(member[metric].minor);
  const memberName = member.isViewer ? "you" : member.displayName;
  const isShare = metric === "share";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show expenses where ${memberName} ${metric === "paid" ? "paid" : "had a share"}`}
      onPress={onOpen}
      hitSlop={4}
      style={({ pressed }) => [
        isShare ? styles.memberShareMetric : styles.memberPaidMetric,
        { opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <Text
        selectable={false}
        style={[
          isShare ? styles.memberShareLabel : styles.memberPaidLabel,
          { color: theme.muted },
        ]}
      >
        {isShare ? "Share" : "Paid"}
      </Text>
      <View
        testID={`member-${metric}-track-${member.userId}`}
        style={[
          isShare ? styles.memberShareTrack : styles.memberPaidTrack,
          { backgroundColor: theme.elevated },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${proportionalWidth(amountMinor, maximumMinor)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text
        testID={`member-${metric}-amount-${member.userId}`}
        selectable={false}
        numberOfLines={1}
        style={[
          isShare ? styles.memberShareAmount : styles.memberPaidAmount,
          { color: isShare ? theme.text : theme.muted },
        ]}
      >
        {formatted(member[metric])}
      </Text>
      <Text
        accessibilityElementsHidden
        selectable={false}
        style={[
          isShare ? styles.memberShareDisclosure : styles.smallDisclosure,
          { color: theme.subtle },
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

function MemberBreakdown({
  members,
  accent,
  onOpenMember,
}: {
  members: GroupStatisticsData["members"];
  accent: string;
  onOpenMember: (
    member: GroupStatisticsData["members"][number],
    metric: "paid" | "share",
  ) => void;
}) {
  const theme = useTheme();
  const shareColor = theme.warning as string;
  const sorted = useMemo(
    () =>
      [...members].sort((left, right) => {
        const leftAmount = BigInt(left.share.minor);
        const rightAmount = BigInt(right.share.minor);
        if (leftAmount === rightAmount) {
          return left.displayName.localeCompare(right.displayName);
        }
        return leftAmount > rightAmount ? -1 : 1;
      }),
    [members],
  );
  const maximumMinor = sorted.reduce((current, member) => {
    const paid = BigInt(member.paid.minor);
    const share = BigInt(member.share.minor);
    return paid > current ? paid : share > current ? share : current;
  }, 0n);

  return (
    <View style={styles.memberContent}>
      <View style={styles.memberList}>
        {sorted.map((member) => {
          const paidMinor = BigInt(member.paid.minor);
          const shareMinor = BigInt(member.share.minor);
          const differenceMinor = paidMinor - shareMinor;
          const differenceLabel =
            differenceMinor > 0n
              ? `Paid ${formattedMinor(differenceMinor, member.paid.currency as CurrencyCode)} more`
              : differenceMinor < 0n
                ? `Paid ${formattedMinor(-differenceMinor, member.share.currency as CurrencyCode)} less`
                : "Even";
          return (
            <View key={member.userId} style={styles.memberRow}>
              <View style={styles.memberHeading}>
                <Avatar
                  name={member.displayName}
                  colorKey={member.userId}
                  imageUrl={member.avatarUrl}
                  size={36}
                />
                <Text
                  selectable={false}
                  numberOfLines={1}
                  style={[styles.memberName, { color: theme.text }]}
                >
                  {member.isViewer
                    ? `${member.displayName} (You)`
                    : member.displayName}
                </Text>
                <Text
                  selectable={false}
                  numberOfLines={1}
                  style={[
                    styles.memberDifference,
                    {
                      color:
                        differenceMinor > 0n
                          ? theme.positive
                          : differenceMinor < 0n
                            ? theme.negative
                            : theme.muted,
                    },
                  ]}
                >
                  {differenceLabel}
                </Text>
              </View>
              <View style={styles.memberMetrics}>
                <MemberMetric
                  member={member}
                  metric="share"
                  maximumMinor={maximumMinor}
                  color={shareColor}
                  onOpen={() => onOpenMember(member, "share")}
                />
                <MemberMetric
                  member={member}
                  metric="paid"
                  maximumMinor={maximumMinor}
                  color={accent}
                  onOpen={() => onOpenMember(member, "paid")}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function GroupStatistics({
  data,
  selection,
  onSelectionChange,
  onOpenCategory,
  onOpenMember,
}: {
  data: GroupStatisticsData;
  selection: StatisticsRangeSelection;
  onSelectionChange: (selection: StatisticsRangeSelection) => void;
  onOpenCategory: (iconKey: ExpenseIconKey) => void;
  onOpenMember: (
    member: GroupStatisticsData["members"][number],
    metric: "paid" | "share",
  ) => void;
}) {
  const theme = useTheme();
  const accent = normalizeGroupColor(data.group.color, data.group.id);
  const totalMinor = BigInt(data.totalSpent.minor);

  return (
    <View style={styles.content}>
      <RangeSelector
        selection={selection}
        onSelectionChange={onSelectionChange}
      />

      <PersonalOverview data={data} accent={accent} />

      {data.expenseCount === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
          <Text selectable={false} style={[styles.emptyTitle, { color: theme.text }]}>
            No spending in this period
          </Text>
          <Text selectable={false} style={[styles.emptyCopy, { color: theme.muted }]}>
            Choose another period or add an expense to unlock the statistics.
          </Text>
        </View>
      ) : (
        <>
          <SectionCard
            title="Spending over time"
            subtitle={`${timelineBucketLabel(data.timelineBucket)} · adapts to your timeframe`}
          >
            <TimelineChart data={data} accent={accent} />
          </SectionCard>

          <SectionCard
            title="Where the money went"
            subtitle="Each color is its share of total spending"
          >
            <CategoryBreakdown
              categories={data.categories}
              totalMinor={totalMinor}
              onOpenCategory={onOpenCategory}
            />
          </SectionCard>

          <SectionCard
            title="Spending by member"
            subtitle="Ranked by share · initial payments shown for context"
          >
            <MemberBreakdown
              members={data.members}
              accent={accent}
              onOpenMember={onOpenMember}
            />
          </SectionCard>
        </>
      )}

      {data.unconvertedExpenseCount > 0 ? (
        <Text selectable={false} style={[styles.warning, { color: theme.warning }]}>
          {data.unconvertedExpenseCount}{" "}
          {data.unconvertedExpenseCount === 1
            ? "expense was"
            : "expenses were"}{" "}
          excluded because its saved exchange rate is unavailable.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  rangeControl: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    gap: 14,
  },
  rangeHeading: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rangeHeadingCopy: { flex: 1, minWidth: 0, gap: 1 },
  rangeEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  rangeCurrent: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  rangeStatusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 4 },
  quickRangeRow: {
    minHeight: 58,
    flexDirection: "row",
    gap: 8,
  },
  quickRange: {
    minHeight: 58,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 6,
    gap: 1,
  },
  quickRangeText: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  quickRangeDetail: {
    width: "100%",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "500",
  },
  customRange: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    gap: 11,
  },
  calendarGlyphWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderCurve: "continuous",
  },
  calendarGlyph: {
    width: 18,
    height: 17,
    borderWidth: 1.7,
    borderRadius: 4,
    paddingTop: 6,
    overflow: "hidden",
  },
  calendarGlyphBar: {
    position: "absolute",
    top: 3,
    left: 0,
    right: 0,
    height: 1.5,
  },
  calendarGlyphDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 3,
    gap: 2.5,
  },
  calendarGlyphDot: { width: 3, height: 3, borderRadius: 1 },
  customRangeCopy: { flex: 1, minWidth: 0, gap: 1 },
  customRangeTitle: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  customRangeValue: { fontSize: 11, lineHeight: 15 },
  customRangeChevron: { fontSize: 25, lineHeight: 27, fontWeight: "300" },
  rangeEditor: {
    gap: 16,
  },
  dateBoundaryRow: { gap: 8 },
  dateBoundaryLine: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "stretch",
  },
  dateTimeline: { width: 22, alignItems: "center" },
  dateTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 24,
    zIndex: 1,
  },
  dateTimelineStem: {
    position: "absolute",
    top: 29,
    bottom: -37,
    width: 2,
  },
  dateBoundary: {
    minHeight: 58,
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    gap: 10,
  },
  dateBoundaryCopy: { flex: 1, minWidth: 0, gap: 1 },
  dateBoundaryLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  dateBoundaryValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  dateBoundaryChevron: { fontSize: 24, lineHeight: 26, fontWeight: "300" },
  inlineDatePicker: { width: "100%", minHeight: 330 },
  rangeActions: { flexDirection: "row", gap: 8 },
  rangeAction: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
  },
  rangeApply: { flex: 1.55 },
  rangeActionText: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  hero: {
    minHeight: 108,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 18,
  },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroAccent: { width: 8, height: 8, borderRadius: 4 },
  heroLabel: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  heroValue: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "700",
    letterSpacing: -1.1,
    fontVariant: ["tabular-nums"],
    paddingTop: 4,
  },
  heroContext: { fontSize: 14, lineHeight: 19, paddingTop: 1 },
  shareTrack: {
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    marginTop: 17,
  },
  shareFill: { height: "100%", borderRadius: 7 },
  shareLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  paymentSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  paymentAmount: { gap: 1 },
  paymentLabel: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  paymentValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  paymentDifference: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  sectionBlock: { gap: 9 },
  sectionHeading: { paddingHorizontal: 4, gap: 2 },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSubtitle: { fontSize: 13, lineHeight: 17 },
  card: {
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  timelineContent: { paddingTop: 16 },
  chartSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  summaryLabel: { fontSize: 12, lineHeight: 16 },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  chartInstruction: {
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  chart: {
    height: 178,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  chartColumn: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  chartValueArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartBar: {
    width: 24,
    alignSelf: "center",
    borderRadius: 7,
    borderCurve: "continuous",
  },
  chartLabel: {
    width: "100%",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 13,
  },
  chartLabelActive: { fontWeight: "700" },
  categoryContent: { paddingTop: 17 },
  compositionBar: {
    height: 18,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 9,
    marginHorizontal: 16,
  },
  rankedList: { padding: 16, gap: 18 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryIconWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryColor: { width: 4, height: 32, borderRadius: 2 },
  rankCopy: { flex: 1, minWidth: 0, gap: 2 },
  rankLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankName: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  rankAmount: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  percent: {
    width: 34,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  disclosure: { fontSize: 23, lineHeight: 23, fontWeight: "300" },
  memberContent: { paddingHorizontal: 16, paddingVertical: 14 },
  memberList: { gap: 16 },
  memberRow: { gap: 8 },
  memberHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  memberDifference: {
    maxWidth: "45%",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  memberMetrics: { gap: 4, paddingLeft: 46 },
  memberShareMetric: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberShareLabel: {
    width: 38,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  memberShareAmount: {
    width: 78,
    textAlign: "right",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  memberShareDisclosure: { fontSize: 20, lineHeight: 20, fontWeight: "300" },
  memberShareTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  memberPaidMetric: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberPaidLabel: {
    width: 38,
    fontSize: 11,
    lineHeight: 15,
  },
  memberPaidAmount: {
    width: 78,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  memberPaidTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  smallDisclosure: { fontSize: 18, lineHeight: 18, fontWeight: "300" },
  emptyCard: {
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 24,
    alignItems: "center",
    gap: 7,
  },
  emptyTitle: { fontSize: 18, lineHeight: 23, fontWeight: "700", textAlign: "center" },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: "center", padding: 24 },
  warning: { fontSize: 12, lineHeight: 17, paddingHorizontal: 8, textAlign: "center" },
});
