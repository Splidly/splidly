import type { CurrencyCode, ExpenseIconKey, Money } from "@splidly/shared";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatConvertedMoney } from "../lib/money-display";
import { normalizeGroupColor } from "../lib/group-colors";
import { useTheme } from "../theme";
import { Avatar } from "./ui";
import { ExpenseIcon, expenseIconLabel } from "./expense-icon";

export type StatisticsRange = "all" | "12-months" | "30-days";

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
    payments: { userId: string; amount: Money }[];
    shares: { userId: string; amount: Money }[];
  }[];
};

const rangeOptions: readonly { value: StatisticsRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "12-months", label: "12 months" },
  { value: "30-days", label: "30 days" },
];

function SegmentedPicker<Value extends string>({
  options,
  value,
  onValueChange,
  testID,
}: {
  options: readonly { value: Value; label: string }[];
  value: Value;
  onValueChange: (value: Value) => void;
  testID: string;
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <SegmentedControl
      testID={testID}
      values={options.map((option) => option.label)}
      selectedIndex={selectedIndex}
      onChange={({ nativeEvent }) => {
        const option = options[nativeEvent.selectedSegmentIndex];
        if (option) onValueChange(option.value);
      }}
      style={styles.segmentedPicker}
    />
  );
}

function formatted(money: Money) {
  return formatConvertedMoney(
    BigInt(money.minor),
    money.currency as CurrencyCode,
  );
}

function percent(amountMinor: bigint, totalMinor: bigint) {
  if (totalMinor <= 0n) return 0;
  return Number((amountMinor * 100n + totalMinor / 2n) / totalMinor);
}

export function statisticsCategoryLabel(iconKey: ExpenseIconKey) {
  return iconKey === "other" ? "Uncategorized" : expenseIconLabel(iconKey);
}

function periodLabel(period: string) {
  const date = new Date(
    period.length === 7 ? `${period}-01T12:00:00.000Z` : `${period}T12:00:00.000Z`,
  );
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    ...(period.length > 7 ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(date);
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.surface }]}>
      <Text selectable style={[styles.statLabel, { color: theme.muted }]}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: theme.text }]}>
        {value}
      </Text>
      <Text style={[styles.statHint, { color: theme.muted }]}>{hint}</Text>
    </View>
  );
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
        <Text selectable style={[styles.sectionTitle, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>
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

function TimelineChart({
  data,
  accent,
}: {
  data: GroupStatisticsData["timeline"];
  accent: string;
}) {
  const theme = useTheme();
  const visibleData = data.slice(-8);
  const maximum = visibleData.reduce(
    (current, point) => {
      const value = BigInt(point.amount.minor);
      return value > current ? value : current;
    },
    0n,
  );
  if (visibleData.length === 0) {
    return (
      <Text style={[styles.emptyCopy, { color: theme.muted }]}>
        Spending trends will appear after the first expense.
      </Text>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Spending over time. ${visibleData
        .map((point) => `${periodLabel(point.period)} ${formatted(point.amount)}`)
        .join(", ")}`}
      style={styles.chart}
    >
      {visibleData.map((point) => {
        const amount = BigInt(point.amount.minor);
        const height =
          maximum === 0n ? 4 : Math.max(4, Number((amount * 100n) / maximum));
        return (
          <View key={point.period} style={styles.chartColumn}>
            <View style={styles.chartValueArea}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: `${height}%`,
                    backgroundColor: accent,
                  },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={[styles.chartLabel, { color: theme.muted }]}>
              {periodLabel(point.period)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CategoryBreakdown({
  categories,
  totalMinor,
  accent,
  onOpenCategory,
}: {
  categories: GroupStatisticsData["categories"];
  totalMinor: bigint;
  accent: string;
  onOpenCategory: (iconKey: ExpenseIconKey) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.rankedList}>
      {categories.map((category) => {
        const amountMinor = BigInt(category.amount.minor);
        const share = percent(amountMinor, totalMinor);
        const label = statisticsCategoryLabel(category.iconKey);
        return (
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
            <ExpenseIcon
              iconKey={category.iconKey}
              name={label}
              size={38}
              useNameFallback={false}
            />
            <View style={styles.rankCopy}>
              <View style={styles.rankLine}>
                <Text selectable numberOfLines={1} style={[styles.rankName, { color: theme.text }]}>
                  {label}
                </Text>
                <Text selectable style={[styles.rankAmount, { color: theme.text }]}>
                  {formatted(category.amount)}
                </Text>
                <Text
                  accessibilityElementsHidden
                  style={[styles.disclosure, { color: theme.subtle }]}
                >
                  ›
                </Text>
              </View>
              <View style={styles.rankLine}>
                <View style={[styles.progressTrack, { backgroundColor: theme.elevated }]}>
                  <View style={[styles.progressFill, { width: `${share}%`, backgroundColor: accent }]} />
                </View>
                <Text style={[styles.percent, { color: theme.muted }]}>{share}%</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
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
  const [metric, setMetric] = useState<"paid" | "share">("share");
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
  const maximum = sorted.reduce((current, member) => {
    const value = BigInt(member[metric].minor);
    return value > current ? value : current;
  }, 0n);
  return (
    <View style={styles.memberContent}>
      <SegmentedPicker
        testID="member-metric"
        options={[
          { value: "share", label: "Share" },
          { value: "paid", label: "Paid" },
        ]}
        value={metric}
        onValueChange={setMetric}
      />
      <View style={styles.memberList}>
        {sorted.map((member) => {
          const amountMinor = BigInt(member[metric].minor);
          const width = maximum === 0n ? 0 : Number((amountMinor * 100n) / maximum);
          return (
            <Pressable
              key={member.userId}
              accessibilityRole="button"
              accessibilityLabel={`Show expenses where ${member.isViewer ? "you" : member.displayName} ${metric === "paid" ? "paid" : "had a share"}`}
              onPress={() => onOpenMember(member, metric)}
              style={({ pressed }) => [
                styles.memberRow,
                { opacity: pressed ? 0.62 : 1 },
              ]}
            >
              <Avatar name={member.displayName} colorKey={member.userId} imageUrl={member.avatarUrl} size={36} />
              <View style={styles.rankCopy}>
                <View style={styles.rankLine}>
                  <Text selectable numberOfLines={1} style={[styles.rankName, { color: theme.text }]}>
                    {member.isViewer ? `${member.displayName} (You)` : member.displayName}
                  </Text>
                  <Text selectable style={[styles.rankAmount, { color: theme.text }]}>
                    {formatted(member[metric])}
                  </Text>
                  <Text
                    accessibilityElementsHidden
                    style={[styles.disclosure, { color: theme.subtle }]}
                  >
                    ›
                  </Text>
                </View>
                <View style={[styles.memberTrack, { backgroundColor: theme.elevated }]}>
                  <View style={[styles.progressFill, { width: `${width}%`, backgroundColor: accent }]} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function GroupStatistics({
  data,
  range,
  onRangeChange,
  onOpenCategory,
  onOpenMember,
}: {
  data: GroupStatisticsData;
  range: StatisticsRange;
  onRangeChange: (range: StatisticsRange) => void;
  onOpenCategory: (iconKey: ExpenseIconKey) => void;
  onOpenMember: (
    member: GroupStatisticsData["members"][number],
    metric: "paid" | "share",
  ) => void;
}) {
  const theme = useTheme();
  const accent = normalizeGroupColor(data.group.color, data.group.id);
  const totalMinor = BigInt(data.totalSpent.minor);
  const paidMinor = BigInt(data.viewerPaid.minor);

  return (
    <View style={styles.content}>
      <SegmentedPicker
        testID="statistics-range"
        options={rangeOptions}
        value={range}
        onValueChange={onRangeChange}
      />

      <View
        testID="statistics-hero"
        style={[
          styles.hero,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.heroHeading}>
          <View style={[styles.heroAccent, { backgroundColor: accent }]} />
          <Text style={[styles.heroLabel, { color: theme.muted }]}>
            Your share
          </Text>
        </View>
        <Text
          key={`${data.viewerShare.currency}:${data.viewerShare.minor}`}
          selectable
          numberOfLines={1}
          style={[styles.heroValue, { color: theme.text }]}
        >
          {formatted(data.viewerShare)}
        </Text>
      </View>

      <View style={styles.statRow}>
        <StatTile label="You paid" value={formatted(data.viewerPaid)} hint={totalMinor > 0n ? `${percent(paidMinor, totalMinor)}% of total` : "No payments yet"} />
        <StatTile label="Total group spending" value={formatted(data.totalSpent)} hint={`${data.expenseCount} ${data.expenseCount === 1 ? "expense" : "expenses"}`} />
      </View>

      {data.expenseCount === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No spending in this period</Text>
          <Text style={[styles.emptyCopy, { color: theme.muted }]}>Choose another period or add an expense to unlock the statistics.</Text>
        </View>
      ) : (
        <>
          <SectionCard title="Spending over time" subtitle={range === "30-days" ? "Daily totals" : "Monthly totals"}>
            <TimelineChart data={data.timeline} accent={accent} />
          </SectionCard>

          <SectionCard title="Where the money went" subtitle={`${data.categories.length} ${data.categories.length === 1 ? "category" : "categories"}`}>
            <CategoryBreakdown
              categories={data.categories}
              totalMinor={totalMinor}
              accent={accent}
              onOpenCategory={onOpenCategory}
            />
          </SectionCard>

          <SectionCard title="Group members" subtitle="Compare money paid with consumed share">
            <MemberBreakdown
              members={data.members}
              accent={accent}
              onOpenMember={onOpenMember}
            />
          </SectionCard>
        </>
      )}

      {data.unconvertedExpenseCount > 0 ? (
        <Text style={[styles.warning, { color: theme.warning }]}>
          {data.unconvertedExpenseCount} {data.unconvertedExpenseCount === 1 ? "expense was" : "expenses were"} excluded because its saved exchange rate is unavailable.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  segmentedPicker: { width: "100%" },
  hero: {
    minHeight: 108,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 18,
    justifyContent: "center",
  },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroAccent: { width: 8, height: 8, borderRadius: 4 },
  heroLabel: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  heroValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    paddingTop: 4,
  },
  statRow: { flexDirection: "row", gap: 12 },
  statTile: { flex: 1, minWidth: 0, borderRadius: 18, borderCurve: "continuous", padding: 16, gap: 4 },
  statLabel: { fontSize: 13, lineHeight: 17, fontWeight: "600" },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.55, fontVariant: ["tabular-nums"] },
  statHint: { fontSize: 12, lineHeight: 16 },
  sectionBlock: { gap: 9 },
  sectionHeading: { paddingHorizontal: 4, gap: 2 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: "700", letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 13, lineHeight: 17 },
  card: { borderRadius: 20, borderCurve: "continuous", overflow: "hidden" },
  chart: { height: 180, flexDirection: "row", alignItems: "stretch", gap: 7, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: "center", gap: 7 },
  chartValueArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartBar: { width: "100%", maxWidth: 30, alignSelf: "center", borderRadius: 7, borderCurve: "continuous" },
  chartLabel: { width: "100%", textAlign: "center", fontSize: 10, lineHeight: 13 },
  rankedList: { padding: 16, gap: 18 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankCopy: { flex: 1, minWidth: 0, gap: 7 },
  rankLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankName: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  rankAmount: { fontSize: 14, lineHeight: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  disclosure: { fontSize: 23, lineHeight: 23, fontWeight: "300" },
  progressTrack: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  percent: { width: 34, textAlign: "right", fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  memberContent: { padding: 12, gap: 16 },
  memberList: { gap: 17, paddingHorizontal: 4, paddingBottom: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  memberTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  emptyCard: { borderRadius: 20, borderCurve: "continuous", padding: 24, alignItems: "center", gap: 7 },
  emptyTitle: { fontSize: 18, lineHeight: 23, fontWeight: "700", textAlign: "center" },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: "center", padding: 24 },
  warning: { fontSize: 12, lineHeight: 17, paddingHorizontal: 8, textAlign: "center" },
});
