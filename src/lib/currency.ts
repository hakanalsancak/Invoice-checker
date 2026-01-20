// Currency formatting utility

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

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}

export function formatPrice(price: number | string, currencyCode: string = "GBP"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${numPrice.toFixed(2)}`;
}

export function formatPriceLocale(price: number | string, currencyCode: string = "GBP"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  const locale = CURRENCY_LOCALES[currencyCode.toUpperCase()] || "en-GB";
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(numPrice);
}
