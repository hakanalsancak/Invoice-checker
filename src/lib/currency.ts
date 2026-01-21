// Currency formatting and conversion utility with LIVE exchange rates

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  TRY: "₺",
};

const CURRENCY_LOCALES: Record<string, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "de-DE",
  TRY: "tr-TR",
};

// Cache for exchange rates (to avoid too many API calls)
let ratesCache: {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback rates in case API fails (Jan 2026)
const FALLBACK_RATES_TO_GBP: Record<string, number> = {
  GBP: 1.0,
  USD: 0.745,
  EUR: 0.84,
  TRY: 0.021,
};

/**
 * Fetch live exchange rates from API
 * Uses exchangerate-api.com (free, no API key required for basic usage)
 */
async function fetchLiveRates(baseCurrency: string = "GBP"): Promise<Record<string, number>> {
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
    // Return fallback rates converted from GBP base
    if (baseCurrency === "GBP") {
      return {
        GBP: 1,
        USD: 1 / FALLBACK_RATES_TO_GBP.USD,
        EUR: 1 / FALLBACK_RATES_TO_GBP.EUR,
        TRY: 1 / FALLBACK_RATES_TO_GBP.TRY,
      };
    }
    // For other bases, just return 1:1 as fallback
    return { [baseCurrency]: 1, GBP: FALLBACK_RATES_TO_GBP[baseCurrency] || 1 };
  }
}

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || currencyCode || "£";
}

export function formatPrice(price: number | string, currencyCode: string = "GBP"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice)) return `${getCurrencySymbol(currencyCode)}0.00`;
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${numPrice.toFixed(2)}`;
}

export function formatPriceLocale(price: number | string, currencyCode: string = "GBP"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  const locale = CURRENCY_LOCALES[currencyCode?.toUpperCase()] || "en-GB";
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode?.toUpperCase() || "GBP",
  }).format(numPrice);
}

/**
 * Get the LIVE exchange rate to convert from one currency to another
 * @param fromCurrency Source currency code (e.g., "USD")
 * @param toCurrency Target currency code (e.g., "GBP")
 * @returns Exchange rate (multiply source amount by this to get target amount)
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency?.toUpperCase() || "USD";
  const to = toCurrency?.toUpperCase() || "GBP";
  
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
    // Use fallback calculation
    const fromToGbp = FALLBACK_RATES_TO_GBP[from] || 1;
    const toToGbp = FALLBACK_RATES_TO_GBP[to] || 1;
    return fromToGbp / toToGbp;
  }
}

/**
 * Synchronous version using fallback rates (for client-side use)
 */
export function getExchangeRateSync(fromCurrency: string, toCurrency: string): number {
  const from = fromCurrency?.toUpperCase() || "USD";
  const to = toCurrency?.toUpperCase() || "GBP";
  
  if (from === to) return 1.0;
  
  // Use cached rates if available
  if (ratesCache && ratesCache.base === from && ratesCache.rates[to]) {
    return ratesCache.rates[to];
  }
  
  // Fallback calculation
  const fromToGbp = FALLBACK_RATES_TO_GBP[from] || 1;
  const toToGbp = FALLBACK_RATES_TO_GBP[to] || 1;
  return fromToGbp / toToGbp;
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
