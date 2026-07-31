import {
  formatMinor,
  minorUnit,
  type CurrencyCode,
} from "@splidly/shared";

type CurrencyDisplay = {
  symbol: string;
  placement: "prefix" | "suffix";
};

const currencyDisplayOverrides: Partial<
  Record<CurrencyCode, CurrencyDisplay>
> = {
  AED: { symbol: "د.إ", placement: "suffix" },
  AFN: { symbol: "؋", placement: "prefix" },
  ALL: { symbol: "L", placement: "suffix" },
  AMD: { symbol: "֏", placement: "suffix" },
  AOA: { symbol: "Kz", placement: "suffix" },
  ARS: { symbol: "AR$", placement: "prefix" },
  AUD: { symbol: "A$", placement: "prefix" },
  AWG: { symbol: "ƒ", placement: "prefix" },
  AZN: { symbol: "₼", placement: "suffix" },
  BAM: { symbol: "KM", placement: "suffix" },
  BBD: { symbol: "Bds$", placement: "prefix" },
  BDT: { symbol: "৳", placement: "prefix" },
  BGN: { symbol: "лв", placement: "suffix" },
  BRL: { symbol: "R$", placement: "prefix" },
  BYN: { symbol: "Br", placement: "suffix" },
  CAD: { symbol: "CA$", placement: "prefix" },
  CHF: { symbol: "Fr.", placement: "prefix" },
  CLP: { symbol: "CL$", placement: "prefix" },
  CNY: { symbol: "CN¥", placement: "prefix" },
  COP: { symbol: "CO$", placement: "prefix" },
  CRC: { symbol: "₡", placement: "prefix" },
  CZK: { symbol: "Kč", placement: "suffix" },
  DKK: { symbol: "kr", placement: "suffix" },
  DOP: { symbol: "RD$", placement: "prefix" },
  EGP: { symbol: "E£", placement: "prefix" },
  EUR: { symbol: "€", placement: "suffix" },
  GBP: { symbol: "£", placement: "prefix" },
  GEL: { symbol: "₾", placement: "suffix" },
  GHS: { symbol: "₵", placement: "prefix" },
  GTQ: { symbol: "Q", placement: "prefix" },
  HKD: { symbol: "HK$", placement: "prefix" },
  HNL: { symbol: "L", placement: "prefix" },
  HUF: { symbol: "Ft", placement: "suffix" },
  IDR: { symbol: "Rp", placement: "prefix" },
  ILS: { symbol: "₪", placement: "prefix" },
  INR: { symbol: "₹", placement: "prefix" },
  IRR: { symbol: "﷼", placement: "suffix" },
  ISK: { symbol: "kr", placement: "suffix" },
  JPY: { symbol: "¥", placement: "prefix" },
  KGS: { symbol: "сом", placement: "suffix" },
  KHR: { symbol: "៛", placement: "prefix" },
  KPW: { symbol: "₩", placement: "prefix" },
  KRW: { symbol: "₩", placement: "prefix" },
  KZT: { symbol: "₸", placement: "suffix" },
  LAK: { symbol: "₭", placement: "prefix" },
  LBP: { symbol: "L£", placement: "prefix" },
  MKD: { symbol: "ден", placement: "suffix" },
  MNT: { symbol: "₮", placement: "prefix" },
  MXN: { symbol: "MX$", placement: "prefix" },
  MYR: { symbol: "RM", placement: "prefix" },
  NGN: { symbol: "₦", placement: "prefix" },
  NOK: { symbol: "kr", placement: "suffix" },
  NZD: { symbol: "NZ$", placement: "prefix" },
  PAB: { symbol: "B/.", placement: "prefix" },
  PEN: { symbol: "S/", placement: "prefix" },
  PHP: { symbol: "₱", placement: "prefix" },
  PLN: { symbol: "zł", placement: "suffix" },
  PYG: { symbol: "₲", placement: "prefix" },
  RON: { symbol: "lei", placement: "suffix" },
  RSD: { symbol: "дин", placement: "suffix" },
  RUB: { symbol: "₽", placement: "suffix" },
  SEK: { symbol: "kr", placement: "suffix" },
  SGD: { symbol: "S$", placement: "prefix" },
  THB: { symbol: "฿", placement: "prefix" },
  TRY: { symbol: "₺", placement: "prefix" },
  TTD: { symbol: "TT$", placement: "prefix" },
  TWD: { symbol: "NT$", placement: "prefix" },
  UAH: { symbol: "₴", placement: "suffix" },
  USD: { symbol: "$", placement: "prefix" },
  UYU: { symbol: "$U", placement: "prefix" },
  VND: { symbol: "₫", placement: "suffix" },
  XAF: { symbol: "FCFA", placement: "suffix" },
  XCD: { symbol: "EC$", placement: "prefix" },
  XOF: { symbol: "F CFA", placement: "suffix" },
  XPF: { symbol: "CFP", placement: "suffix" },
  ZAR: { symbol: "R", placement: "prefix" },
};

const displayCache = new Map<CurrencyCode, CurrencyDisplay>();

function intlCurrencyDisplay(currency: CurrencyCode): CurrencyDisplay | null {
  try {
    const formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
    const parts =
      typeof formatter.formatToParts === "function"
        ? formatter.formatToParts(0)
        : [];
    const currencyPart = parts.find((part) => part.type === "currency");
    const integerIndex = parts.findIndex((part) => part.type === "integer");
    const currencyIndex = parts.findIndex((part) => part.type === "currency");
    if (
      currencyPart?.value &&
      currencyPart.value !== currency &&
      currencyPart.value !== "¤"
    ) {
      return {
        symbol: currencyPart.value,
        placement:
          currencyIndex >= 0 &&
          integerIndex >= 0 &&
          currencyIndex > integerIndex
            ? "suffix"
            : "prefix",
      };
    }

    const formatted = formatter.format(0).trim();
    const candidate = formatted
      .replace(/[\d\s.,\-+()]/g, "")
      .trim();
    if (candidate && candidate !== currency && candidate !== "¤") {
      return {
        symbol: candidate,
        placement: formatted.indexOf(candidate) > formatted.search(/\d/)
          ? "suffix"
          : "prefix",
      };
    }
  } catch {
    // Unsupported or special-purpose codes remain readable as ISO codes.
  }
  return null;
}

function currencyDisplay(currency: CurrencyCode): CurrencyDisplay {
  const cached = displayCache.get(currency);
  if (cached) return cached;

  const display =
    currencyDisplayOverrides[currency] ??
    intlCurrencyDisplay(currency) ?? {
      symbol: currency,
      placement: "suffix" as const,
    };
  displayCache.set(currency, display);
  return display;
}

export function currencySymbol(currency: CurrencyCode): string {
  return currencyDisplay(currency).symbol;
}

export function currencySymbolWithCode(currency: CurrencyCode): string {
  const symbol = currencySymbol(currency);
  return symbol === currency ? currency : `${symbol} · ${currency}`;
}

function roundMinorToDigits(
  minor: bigint,
  currency: CurrencyCode,
  digits: number,
): bigint {
  const sourceDigits = minorUnit(currency);
  if (sourceDigits === digits) return minor;
  if (sourceDigits < digits) {
    return minor * 10n ** BigInt(digits - sourceDigits);
  }

  const sign = minor < 0n ? -1n : 1n;
  const absolute = minor < 0n ? -minor : minor;
  const divisor = 10n ** BigInt(sourceDigits - digits);
  const quotient = absolute / divisor;
  const remainder = absolute % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return sign * rounded;
}

function formatFixedDigits(value: bigint, digits: number): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  if (digits === 0) return `${sign}${absolute}`;

  const base = 10n ** BigInt(digits);
  return `${sign}${absolute / base}.${String(absolute % base).padStart(
    digits,
    "0",
  )}`;
}

function withCurrencySymbol(amount: string, currency: CurrencyCode): string {
  const { symbol, placement } = currencyDisplay(currency);
  if (symbol === currency) return `${amount} ${currency}`;
  if (placement === "suffix") return `${amount} ${symbol}`;
  if (amount.startsWith("-")) return `-${symbol}${amount.slice(1)}`;
  return `${symbol}${amount}`;
}

export function formatMoney(
  minor: bigint | string,
  currency: CurrencyCode,
): string {
  return withCurrencySymbol(formatMinor(minor, currency), currency);
}

export function formatConvertedMoney(
  minor: bigint | string,
  currency: CurrencyCode,
): string {
  const value = typeof minor === "string" ? BigInt(minor) : minor;
  return withCurrencySymbol(
    formatFixedDigits(roundMinorToDigits(value, currency, 2), 2),
    currency,
  );
}
