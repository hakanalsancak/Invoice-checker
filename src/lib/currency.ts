// Currency formatting and conversion utility with LIVE exchange rates

// 20+ most popular world currencies
export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", locale: "es-MX" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "zh-HK" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", locale: "nb-NO" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", locale: "da-DK" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ" },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", locale: "ru-RU" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", locale: "pl-PL" },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", locale: "ar-SA" },
] as const;

// Build lookup maps for quick access
const CURRENCY_MAP = new Map(SUPPORTED_CURRENCIES.map(c => [c.code, c]));

// Cache for exchange rates (to avoid too many API calls)
let ratesCache: {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback rates to USD in case API fails (approximate Jan 2026)
const FALLBACK_RATES_FROM_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 148.5,
  CHF: 0.88,
  CAD: 1.36,
  AUD: 1.54,
  CNY: 7.25,
  INR: 83.5,
  MXN: 17.2,
  BRL: 4.95,
  KRW: 1320,
  SGD: 1.34,
  HKD: 7.82,
  NOK: 10.5,
  SEK: 10.3,
  DKK: 6.85,
  NZD: 1.62,
  ZAR: 18.7,
  RUB: 92.5,
  TRY: 32.5,
  PLN: 4.02,
  THB: 35.2,
  AED: 3.67,
  SAR: 3.75,
};

/**
 * Fetch live exchange rates from API
 * Uses exchangerate-api.com (free, no API key required for basic usage)
 */
async function fetchLiveRates(baseCurrency: string = "USD"): Promise<Record<string, number>> {
  try {
    // Check cache first
    if (ratesCache && 
        ratesCache.base === baseCurrency && 
        Date.now() - ratesCache.timestamp < CACHE_DURATION) {
      return ratesCache.rates;
    }

    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour in Next.js
    );

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    
    // Update cache
    ratesCache = {
      base: baseCurrency,
      rates: data.rates,
      timestamp: Date.now(),
    };

    console.log(`[Currency] Fetched live rates for ${baseCurrency}`);
    return data.rates;
  } catch (error) {
    console.error("[Currency] Failed to fetch live rates, using fallback:", error);
    
    // Convert fallback rates to requested base
    if (baseCurrency === "USD") {
      return { ...FALLBACK_RATES_FROM_USD };
    }
    
    // Convert from USD-based fallback to requested base
    const baseRateFromUsd = FALLBACK_RATES_FROM_USD[baseCurrency] || 1;
    const convertedRates: Record<string, number> = {};
    
    for (const [currency, rateFromUsd] of Object.entries(FALLBACK_RATES_FROM_USD)) {
      convertedRates[currency] = rateFromUsd / baseRateFromUsd;
    }
    
    return convertedRates;
  }
}

export function getCurrencySymbol(currencyCode: string): string {
  const currency = CURRENCY_MAP.get(currencyCode?.toUpperCase());
  return currency?.symbol || currencyCode || "$";
}

export function getCurrencyInfo(currencyCode: string) {
  return CURRENCY_MAP.get(currencyCode?.toUpperCase());
}

export function formatPrice(price: number | string, currencyCode: string = "USD"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice)) return `${getCurrencySymbol(currencyCode)}0.00`;
  
  const currency = CURRENCY_MAP.get(currencyCode?.toUpperCase());
  const symbol = currency?.symbol || currencyCode;
  
  // For currencies like JPY that don't use decimals
  if (currencyCode === "JPY" || currencyCode === "KRW") {
    return `${symbol}${Math.round(numPrice).toLocaleString()}`;
  }
  
  return `${symbol}${numPrice.toFixed(2)}`;
}

export function formatPriceLocale(price: number | string, currencyCode: string = "USD"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  const currency = CURRENCY_MAP.get(currencyCode?.toUpperCase());
  const locale = currency?.locale || "en-US";
  
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode?.toUpperCase() || "USD",
    }).format(numPrice);
  } catch {
    return formatPrice(numPrice, currencyCode);
  }
}

/**
 * Get the LIVE exchange rate to convert from one currency to another
 * @param fromCurrency Source currency code (e.g., "USD")
 * @param toCurrency Target currency code (e.g., "GBP")
 * @returns Exchange rate (multiply source amount by this to get target amount)
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency?.toUpperCase() || "USD";
  const to = toCurrency?.toUpperCase() || "USD";
  
  if (from === to) return 1.0;
  
  try {
    // Fetch rates with 'from' currency as base
    const rates = await fetchLiveRates(from);
    const rate = rates[to];
    
    if (rate) {
      console.log(`[Currency] Live rate: 1 ${from} = ${rate} ${to}`);
      return rate;
    }
    
    // Fallback if specific rate not found
    throw new Error(`Rate not found for ${from} to ${to}`);
  } catch (error) {
    console.error("[Currency] Using fallback rate:", error);
    // Use fallback calculation via USD
    const fromRateFromUsd = FALLBACK_RATES_FROM_USD[from] || 1;
    const toRateFromUsd = FALLBACK_RATES_FROM_USD[to] || 1;
    return toRateFromUsd / fromRateFromUsd;
  }
}

/**
 * Synchronous version using fallback/cached rates (for client-side use)
 */
export function getExchangeRateSync(fromCurrency: string, toCurrency: string): number {
  const from = fromCurrency?.toUpperCase() || "USD";
  const to = toCurrency?.toUpperCase() || "USD";
  
  if (from === to) return 1.0;
  
  // Use cached rates if available
  if (ratesCache && ratesCache.base === from && ratesCache.rates[to]) {
    return ratesCache.rates[to];
  }
  
  // Fallback calculation via USD
  const fromRateFromUsd = FALLBACK_RATES_FROM_USD[from] || 1;
  const toRateFromUsd = FALLBACK_RATES_FROM_USD[to] || 1;
  return toRateFromUsd / fromRateFromUsd;
}

/**
 * Convert an amount from one currency to another (async, uses live rates)
 */
export async function convertCurrency(
  amount: number | string,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return numAmount * rate;
}

/**
 * Convert an amount using sync fallback rates
 */
export function convertCurrencySync(
  amount: number | string,
  fromCurrency: string,
  toCurrency: string
): number {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const rate = getExchangeRateSync(fromCurrency, toCurrency);
  return numAmount * rate;
}

/**
 * Format a price with conversion info
 */
export function formatPriceWithConversion(
  originalPrice: number | string,
  originalCurrency: string,
  targetCurrency: string
): { original: string; converted: string; rate: number } {
  const numPrice = typeof originalPrice === "string" ? parseFloat(originalPrice) : originalPrice;
  const rate = getExchangeRateSync(originalCurrency, targetCurrency);
  const convertedPrice = numPrice * rate;
  
  return {
    original: formatPrice(numPrice, originalCurrency),
    converted: formatPrice(convertedPrice, targetCurrency),
    rate,
  };
}
