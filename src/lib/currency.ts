// Currency formatting and conversion utility

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  TRY: "₺",
  // Add more as needed
};

const CURRENCY_LOCALES: Record<string, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "de-DE",
  TRY: "tr-TR",
};

// Exchange rates relative to GBP (base currency)
// These are approximate rates - in production, use a live API
const EXCHANGE_RATES_TO_GBP: Record<string, number> = {
  GBP: 1.0,
  USD: 0.79,    // 1 USD = 0.79 GBP (approx)
  EUR: 0.86,    // 1 EUR = 0.86 GBP (approx)
  TRY: 0.024,   // 1 TRY = 0.024 GBP (approx)
};

// Exchange rates from GBP to other currencies
const EXCHANGE_RATES_FROM_GBP: Record<string, number> = {
  GBP: 1.0,
  USD: 1.27,    // 1 GBP = 1.27 USD (approx)
  EUR: 1.16,    // 1 GBP = 1.16 EUR (approx)
  TRY: 41.67,   // 1 GBP = 41.67 TRY (approx)
};

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || currencyCode || "£";
}

export function formatPrice(price: number | string, currencyCode: string = "GBP"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
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
 * Get the exchange rate to convert from one currency to another
 * @param fromCurrency Source currency code (e.g., "USD")
 * @param toCurrency Target currency code (e.g., "GBP")
 * @returns Exchange rate (multiply source amount by this to get target amount)
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  const from = fromCurrency?.toUpperCase() || "USD";
  const to = toCurrency?.toUpperCase() || "GBP";
  
  if (from === to) return 1.0;
  
  // Convert to GBP first, then to target currency
  const toGbp = EXCHANGE_RATES_TO_GBP[from] || 1.0;
  const fromGbp = EXCHANGE_RATES_FROM_GBP[to] || 1.0;
  
  // If target is GBP, just return the rate to GBP
  if (to === "GBP") return toGbp;
  
  // If source is GBP, just return the rate from GBP
  if (from === "GBP") return fromGbp;
  
  // Otherwise, convert via GBP: from -> GBP -> to
  return toGbp * fromGbp;
}

/**
 * Convert an amount from one currency to another
 * @param amount Amount in source currency
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number | string,
  fromCurrency: string,
  toCurrency: string
): number {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const rate = getExchangeRate(fromCurrency, toCurrency);
  return numAmount * rate;
}

/**
 * Format a price with conversion info
 * @param originalPrice Original price
 * @param originalCurrency Original currency
 * @param targetCurrency Target currency for display
 * @returns Formatted string showing both prices
 */
export function formatPriceWithConversion(
  originalPrice: number | string,
  originalCurrency: string,
  targetCurrency: string
): { original: string; converted: string; rate: number } {
  const numPrice = typeof originalPrice === "string" ? parseFloat(originalPrice) : originalPrice;
  const rate = getExchangeRate(originalCurrency, targetCurrency);
  const convertedPrice = numPrice * rate;
  
  return {
    original: formatPrice(numPrice, originalCurrency),
    converted: formatPrice(convertedPrice, targetCurrency),
    rate,
  };
}
