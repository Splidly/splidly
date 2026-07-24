import type { CurrencyCode, Money } from "./contracts";

const MINOR_UNIT_OVERRIDES: Record<string, number> = {
  BHD: 3,
  CLF: 4,
  IQD: 3,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  PYG: 0,
  TND: 3,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

export function minorUnit(currency: CurrencyCode): number {
  return MINOR_UNIT_OVERRIDES[currency] ?? 2;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

export function parseDecimalToMinor(
  value: string,
  currency: CurrencyCode,
): bigint {
  const normalized = value.trim().replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(normalized);
  if (!match) {
    throw new Error("Invalid monetary amount");
  }

  const digits = minorUnit(currency);
  const fraction = match[3] ?? "";
  if (fraction.length > digits) {
    throw new Error(`${currency} supports at most ${digits} decimal places`);
  }

  const absolute =
    BigInt(match[2] ?? "0") * pow10(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  return match[1] === "-" ? -absolute : absolute;
}

export function formatMinor(
  minor: bigint | string,
  currency: CurrencyCode,
): string {
  const value = typeof minor === "string" ? BigInt(minor) : minor;
  const digits = minorUnit(currency);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  if (digits === 0) {
    return `${sign}${absolute}`;
  }
  const base = pow10(digits);
  return `${sign}${absolute / base}.${String(absolute % base).padStart(digits, "0")}`;
}

function decimalFraction(value: string): {
  numerator: bigint;
  denominator: bigint;
} {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new Error("Rate must be a positive decimal string");
  }
  const fraction = match[2] ?? "";
  return {
    numerator: BigInt(`${match[1]}${fraction}`),
    denominator: pow10(fraction.length),
  };
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function convertMinor(
  amountMinor: bigint,
  base: CurrencyCode,
  quote: CurrencyCode,
  rate: string,
): bigint {
  if (base === quote) {
    return amountMinor;
  }
  if (amountMinor < 0n) {
    return -convertMinor(-amountMinor, base, quote, rate);
  }
  const fraction = decimalFraction(rate);
  const numerator =
    amountMinor * fraction.numerator * pow10(minorUnit(quote));
  const denominator =
    fraction.denominator * pow10(minorUnit(base));
  return roundHalfUp(numerator, denominator);
}

export function allocateByWeights(
  totalMinor: bigint,
  weights: readonly bigint[],
): bigint[] {
  if (totalMinor < 0n || weights.length === 0 || weights.some((x) => x < 0n)) {
    throw new Error("Allocation requires non-negative values and weights");
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
  if (totalWeight === 0n) {
    throw new Error("At least one allocation weight must be positive");
  }

  const raw = weights.map((weight, index) => ({
    index,
    quotient: (totalMinor * weight) / totalWeight,
    remainder: (totalMinor * weight) % totalWeight,
  }));
  let remaining =
    totalMinor - raw.reduce((sum, value) => sum + value.quotient, 0n);
  raw.sort(
    (a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
  );
  for (const value of raw) {
    if (remaining === 0n) break;
    value.quotient += 1n;
    remaining -= 1n;
  }
  raw.sort((a, b) => a.index - b.index);
  return raw.map((value) => value.quotient);
}

export function splitSourceAmount(
  totalMinor: bigint,
  input:
    | { mode: "equal"; participantIds: string[] }
    | { mode: "exact"; shares: { userId: string; amountMinor: string }[] },
): Map<string, bigint> {
  const ids =
    input.mode === "equal"
      ? input.participantIds
      : input.shares.map((share) => share.userId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("A participant may only appear once");
  }

  if (input.mode === "equal") {
    const amounts = allocateByWeights(
      totalMinor,
      input.participantIds.map(() => 1n),
    );
    return new Map(
      input.participantIds.map((id, index) => [id, amounts[index] ?? 0n]),
    );
  }

  const shares = input.shares.map((share) => BigInt(share.amountMinor));
  if (shares.reduce((sum, share) => sum + share, 0n) !== totalMinor) {
    throw new Error("Exact shares must equal the expense total");
  }
  return new Map(
    input.shares.map((share) => [share.userId, BigInt(share.amountMinor)]),
  );
}

export function money(currency: CurrencyCode, minor: bigint): Money {
  return { currency, minor: minor.toString() };
}
