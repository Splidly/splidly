import type { CurrencyCode } from "@splidly/shared";
import type { CurrencyOption } from "../lib/currencies";

export type CurrencySection = {
  title: string;
  data: CurrencyOption[];
};

export type CurrencyNativeListProps = {
  sections: readonly CurrencySection[];
  value: CurrencyCode;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (currency: CurrencyCode) => void;
};
