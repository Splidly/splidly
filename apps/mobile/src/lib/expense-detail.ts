import {
  convertMinor,
  type CurrencyCode,
  type RateSnapshot,
} from "@splidly/shared";

export function expenseTotalInCurrency(
  sourceAmountMinor: bigint,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  rates: readonly RateSnapshot[],
): bigint | undefined {
  if (sourceCurrency === targetCurrency) return sourceAmountMinor;
  const rate = rates.find(
    (candidate) =>
      candidate.base === sourceCurrency && candidate.quote === targetCurrency,
  );
  if (!rate) return undefined;
  return convertMinor(
    sourceAmountMinor,
    sourceCurrency,
    targetCurrency,
    rate.rate,
  );
}
