import type { CurrencyCode } from "@splidly/shared";

export type CurrencySelection = {
  value: CurrencyCode;
  recentCurrencies: CurrencyCode[];
  onSelect: (currency: CurrencyCode) => void;
};

let activeSelection: CurrencySelection | undefined;

export function beginCurrencySelection(
  value: CurrencyCode,
  onSelect: (currency: CurrencyCode) => void,
  recentCurrencies: CurrencyCode[] = [],
) {
  activeSelection = { value, recentCurrencies, onSelect };
}

export function getCurrencySelection() {
  return activeSelection;
}

export function endCurrencySelection(selection?: CurrencySelection) {
  if (!selection || activeSelection === selection) {
    activeSelection = undefined;
  }
}
