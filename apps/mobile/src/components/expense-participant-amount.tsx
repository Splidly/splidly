import type { CurrencyCode, RateSnapshot } from "@splidly/shared";
import { Text, View } from "react-native";
import { expenseTotalInCurrency } from "../lib/expense-detail";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { MoneyValue } from "./ui";

export function ExpenseParticipantAmount({
  sourceAmountMinor,
  sourceCurrency,
  homeCurrency,
  rates,
}: {
  sourceAmountMinor: bigint;
  sourceCurrency: CurrencyCode;
  homeCurrency: CurrencyCode;
  rates: readonly RateSnapshot[];
}) {
  const theme = useTheme();
  const homeAmountMinor =
    homeCurrency === sourceCurrency
      ? undefined
      : expenseTotalInCurrency(
          sourceAmountMinor,
          sourceCurrency,
          homeCurrency,
          rates,
        );

  return (
    <View style={{ alignItems: "flex-end", gap: 1 }}>
      <MoneyValue minor={sourceAmountMinor} currency={sourceCurrency} />
      {homeAmountMinor !== undefined ? (
        <Text
          selectable={false}
          style={{
            color: theme.muted,
            fontSize: 13,
            lineHeight: 17,
            fontWeight: "500",
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatMoney(homeAmountMinor, homeCurrency)}
        </Text>
      ) : null}
    </View>
  );
}
