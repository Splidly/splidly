import type { CurrencyCode, ExpenseIconKey } from "@splidly/shared";
import { Text, View } from "react-native";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { ExpenseIcon } from "./expense-icon";

export function ExpenseDetailHero({
  description,
  iconKey,
  iconManuallySet,
  sourceAmountMinor,
  sourceCurrency,
  homeAmountMinor,
  homeCurrency,
  dateLabel,
  ledgerLabel,
}: {
  description: string;
  iconKey: ExpenseIconKey;
  iconManuallySet: boolean;
  sourceAmountMinor: bigint;
  sourceCurrency: CurrencyCode;
  homeAmountMinor?: bigint | undefined;
  homeCurrency?: CurrencyCode | undefined;
  dateLabel: string;
  ledgerLabel: string;
}) {
  const theme = useTheme();
  const convertedAmount =
    homeCurrency &&
    homeCurrency !== sourceCurrency &&
    homeAmountMinor !== undefined
      ? formatMoney(homeAmountMinor, homeCurrency)
      : undefined;

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 26,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 10px 32px rgba(0, 0, 0, 0.09)",
      }}
    >
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 20,
          gap: 9,
        }}
      >
        <ExpenseIcon
          iconKey={iconKey}
          name={description}
          size={66}
          useNameFallback={!iconManuallySet}
        />
        <Text
          selectable
          numberOfLines={2}
          style={{
            color: theme.text,
            maxWidth: "92%",
            fontSize: 20,
            lineHeight: 25,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {description}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: theme.text,
            maxWidth: "100%",
            fontSize: 38,
            lineHeight: 45,
            fontWeight: "700",
            letterSpacing: -1.2,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatMoney(sourceAmountMinor, sourceCurrency)}
        </Text>
        {convertedAmount ? (
          <View
            accessible
            accessibilityLabel={`${convertedAmount} in your home currency`}
            style={{
              marginTop: 2,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 15,
              backgroundColor: theme.elevated,
            }}
          >
            <Text
              selectable
              style={{
                color: theme.primary,
                fontSize: 14,
                lineHeight: 18,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              ≈ {convertedAmount}
              <Text style={{ color: theme.muted, fontWeight: "500" }}>
                {" "}in your home currency
              </Text>
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: theme.border }} />
      <View
        style={{
          minHeight: 58,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Metadata label="Date" value={dateLabel} />
        <View
          style={{ width: 1, height: 30, backgroundColor: theme.border }}
        />
        <Metadata label="Ledger" value={ledgerLabel} align="right" />
      </View>
    </View>
  );
}

function Metadata({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        gap: 1,
        alignItems: align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <Text
        style={{
          color: theme.muted,
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        numberOfLines={1}
        style={{
          color: theme.text,
          maxWidth: "100%",
          fontSize: 14,
          lineHeight: 18,
          fontWeight: "600",
          textAlign: align,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
