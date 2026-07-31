import type { CurrencyCode } from "@splidly/shared";
import { router } from "expo-router";
import { beginCurrencySelection } from "../lib/currency-selection";
import { getCurrency } from "../lib/currencies";
import { currencySymbolWithCode } from "../lib/money-display";
import { ListRow } from "./ui";

export function CurrencyField({
  label,
  value,
  onValueChange,
  recentCurrencies = [],
  disabled = false,
}: {
  label: string;
  value: CurrencyCode;
  onValueChange: (currency: CurrencyCode) => void;
  recentCurrencies?: CurrencyCode[];
  disabled?: boolean;
}) {
  function open() {
    beginCurrencySelection(value, onValueChange, recentCurrencies);
    router.push("/currency-picker");
  }

  return (
    <ListRow
      title={label}
      value={getCurrency(value)?.name ?? value}
      valueFallback={currencySymbolWithCode(value)}
      {...(!disabled && { onPress: open })}
    />
  );
}
