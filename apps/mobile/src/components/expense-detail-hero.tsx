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
        padding: 14,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: theme.surface,
        boxShadow: "0 4px 18px rgba(0, 0, 0, 0.07)",
        gap: 13,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ExpenseIcon
          iconKey={iconKey}
          name={description}
          size={52}
          useNameFallback={!iconManuallySet}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
          <View
            testID="expense-summary-line"
            style={{
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text
              selectable
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                color: theme.text,
                fontSize: 18,
                lineHeight: 23,
                fontWeight: "600",
              }}
            >
              {description}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                maxWidth: "46%",
                color: theme.text,
                fontSize: 23,
                lineHeight: 28,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                letterSpacing: -0.4,
              }}
            >
              {formatMoney(sourceAmountMinor, sourceCurrency)}
            </Text>
          </View>
          {convertedAmount ? (
            <View
              accessible
              accessibilityLabel={`${convertedAmount} in your home currency`}
              style={{
                minHeight: 29,
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor: theme.elevated,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: theme.muted,
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "600",
                }}
              >
                Home currency
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={{
                  color: theme.primary,
                  fontSize: 14,
                  lineHeight: 18,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                ≈ {convertedAmount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.border }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Metadata label="Date" value={dateLabel} />
        <View
          style={{ width: 1, height: 28, backgroundColor: theme.border }}
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
