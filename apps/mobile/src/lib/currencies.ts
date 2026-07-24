import type { CurrencyCode } from "@splidly/shared";
import * as SecureStore from "expo-secure-store";

const RECENT_CURRENCIES_KEY = "splidly.recent-currencies.v1";

// ISO 4217 List One, published by SIX on 2026-01-01.
const ISO_4217_DATA = `AED|UAE Dirham
AFN|Afghani
ALL|Lek
AMD|Armenian Dram
AOA|Kwanza
ARS|Argentine Peso
AUD|Australian Dollar
AWG|Aruban Florin
AZN|Azerbaijan Manat
BAM|Convertible Mark
BBD|Barbados Dollar
BDT|Taka
BHD|Bahraini Dinar
BIF|Burundi Franc
BMD|Bermudian Dollar
BND|Brunei Dollar
BOB|Boliviano
BOV|Mvdol
BRL|Brazilian Real
BSD|Bahamian Dollar
BTN|Ngultrum
BWP|Pula
BYN|Belarusian Ruble
BZD|Belize Dollar
CAD|Canadian Dollar
CDF|Congolese Franc
CHE|WIR Euro
CHF|Swiss Franc
CHW|WIR Franc
CLF|Unidad de Fomento
CLP|Chilean Peso
CNY|Yuan Renminbi
COP|Colombian Peso
COU|Unidad de Valor Real
CRC|Costa Rican Colon
CUP|Cuban Peso
CVE|Cabo Verde Escudo
CZK|Czech Koruna
DJF|Djibouti Franc
DKK|Danish Krone
DOP|Dominican Peso
DZD|Algerian Dinar
EGP|Egyptian Pound
ERN|Nakfa
ETB|Ethiopian Birr
EUR|Euro
FJD|Fiji Dollar
FKP|Falkland Islands Pound
GBP|Pound Sterling
GEL|Lari
GHS|Ghana Cedi
GIP|Gibraltar Pound
GMD|Dalasi
GNF|Guinean Franc
GTQ|Quetzal
GYD|Guyana Dollar
HKD|Hong Kong Dollar
HNL|Lempira
HTG|Gourde
HUF|Forint
IDR|Rupiah
ILS|New Israeli Sheqel
INR|Indian Rupee
IQD|Iraqi Dinar
IRR|Iranian Rial
ISK|Iceland Krona
JMD|Jamaican Dollar
JOD|Jordanian Dinar
JPY|Yen
KES|Kenyan Shilling
KGS|Som
KHR|Riel
KMF|Comorian Franc
KPW|North Korean Won
KRW|Won
KWD|Kuwaiti Dinar
KYD|Cayman Islands Dollar
KZT|Tenge
LAK|Lao Kip
LBP|Lebanese Pound
LKR|Sri Lanka Rupee
LRD|Liberian Dollar
LSL|Loti
LYD|Libyan Dinar
MAD|Moroccan Dirham
MDL|Moldovan Leu
MGA|Malagasy Ariary
MKD|Denar
MMK|Kyat
MNT|Tugrik
MOP|Pataca
MRU|Ouguiya
MUR|Mauritius Rupee
MVR|Rufiyaa
MWK|Malawi Kwacha
MXN|Mexican Peso
MXV|Mexican Unidad de Inversion (UDI)
MYR|Malaysian Ringgit
MZN|Mozambique Metical
NAD|Namibia Dollar
NGN|Naira
NIO|Cordoba Oro
NOK|Norwegian Krone
NPR|Nepalese Rupee
NZD|New Zealand Dollar
OMR|Rial Omani
PAB|Balboa
PEN|Sol
PGK|Kina
PHP|Philippine Peso
PKR|Pakistan Rupee
PLN|Zloty
PYG|Guarani
QAR|Qatari Rial
RON|Romanian Leu
RSD|Serbian Dinar
RUB|Russian Ruble
RWF|Rwanda Franc
SAR|Saudi Riyal
SBD|Solomon Islands Dollar
SCR|Seychelles Rupee
SDG|Sudanese Pound
SEK|Swedish Krona
SGD|Singapore Dollar
SHP|Saint Helena Pound
SLE|Leone
SOS|Somali Shilling
SRD|Surinam Dollar
SSP|South Sudanese Pound
STN|Dobra
SVC|El Salvador Colon
SYP|Syrian Pound
SZL|Lilangeni
THB|Baht
TJS|Somoni
TMT|Turkmenistan New Manat
TND|Tunisian Dinar
TOP|Pa’anga
TRY|Turkish Lira
TTD|Trinidad and Tobago Dollar
TWD|New Taiwan Dollar
TZS|Tanzanian Shilling
UAH|Hryvnia
UGX|Uganda Shilling
USD|US Dollar
USN|US Dollar (Next day)
UYI|Uruguay Peso en Unidades Indexadas (UI)
UYU|Peso Uruguayo
UYW|Unidad Previsional
UZS|Uzbekistan Sum
VED|Bolívar Soberano
VES|Bolívar Soberano
VND|Dong
VUV|Vatu
WST|Tala
XAD|Arab Accounting Dinar
XAF|CFA Franc BEAC
XAG|Silver
XAU|Gold
XBA|Bond Markets Unit European Composite Unit (EURCO)
XBB|Bond Markets Unit European Monetary Unit (E.M.U.-6)
XBC|Bond Markets Unit European Unit of Account 9 (E.U.A.-9)
XBD|Bond Markets Unit European Unit of Account 17 (E.U.A.-17)
XCD|East Caribbean Dollar
XCG|Caribbean Guilder
XDR|SDR (Special Drawing Right)
XOF|CFA Franc BCEAO
XPD|Palladium
XPF|CFP Franc
XPT|Platinum
XSU|Sucre
XTS|Codes specifically reserved for testing purposes
XUA|ADB Unit of Account
XXX|The codes assigned for transactions where no currency is involved
YER|Yemeni Rial
ZAR|Rand
ZMW|Zambian Kwacha
ZWG|Zimbabwe Gold`;

export type CurrencyOption = {
  code: CurrencyCode;
  name: string;
};

export const currencies: CurrencyOption[] = ISO_4217_DATA.split("\n").map(
  (line) => {
    const separator = line.indexOf("|");
    return {
      code: line.slice(0, separator) as CurrencyCode,
      name: line.slice(separator + 1),
    };
  },
);

const currencyByCode = new Map(
  currencies.map((currency) => [currency.code, currency]),
);

let cachedRecentCurrencies: CurrencyCode[] | undefined;

export function getCurrency(code: string) {
  return currencyByCode.get(code as CurrencyCode);
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return currencyByCode.has(code as CurrencyCode);
}

export function addRecentCurrency(
  current: readonly CurrencyCode[],
  currency: CurrencyCode,
): CurrencyCode[] {
  return [currency, ...current.filter((code) => code !== currency)].slice(0, 5);
}

export async function loadRecentCurrencies(): Promise<CurrencyCode[]> {
  if (cachedRecentCurrencies) return cachedRecentCurrencies;
  try {
    const stored = await SecureStore.getItemAsync(RECENT_CURRENCIES_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    cachedRecentCurrencies = Array.isArray(parsed)
      ? parsed
          .filter(
            (value): value is CurrencyCode =>
              typeof value === "string" && isSupportedCurrency(value),
          )
          .slice(0, 5)
      : [];
  } catch {
    cachedRecentCurrencies = [];
  }
  return cachedRecentCurrencies;
}

export async function rememberCurrency(
  currency: CurrencyCode,
): Promise<CurrencyCode[]> {
  const current = await loadRecentCurrencies();
  cachedRecentCurrencies = addRecentCurrency(current, currency);
  try {
    await SecureStore.setItemAsync(
      RECENT_CURRENCIES_KEY,
      JSON.stringify(cachedRecentCurrencies),
    );
  } catch {
    // The in-memory recent list still works when secure storage is unavailable.
  }
  return cachedRecentCurrencies;
}
