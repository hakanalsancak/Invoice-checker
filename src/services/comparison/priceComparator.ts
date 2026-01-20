import { db } from "@/lib/db";
import { matchProducts } from "@/services/ai/productMatcher";
import { ComparisonStatus, MatchConfidence } from "@/types";
import { convertCurrency, getExchangeRate } from "@/lib/currency";

interface ComparisonItemResult {
  receiptItemId: string;
  catalogueItemId: string | null;
  receiptPrice: number; // Original price in receipt currency
  receiptPriceConverted: number | null; // Converted to catalogue currency
  cataloguePrice: number | null; // Price in catalogue currency
  priceDifference: number | null; // Difference (converted - catalogue)
  percentageDiff: number | null;
  exchangeRate: number | null;
  matchConfidence: MatchConfidence;
  status: ComparisonStatus;
}

interface ComparisonResult {
  totalItems: number;
  matchedItems: number;
  mismatches: number;
  totalOvercharge: number;
  totalUndercharge: number;
  receiptCurrency: string;
  catalogueCurrency: string;
  exchangeRate: number;
  items: ComparisonItemResult[];
}

export async function compareReceiptWithCatalogue(
  receiptId: string,
  catalogueId: string
): Promise<ComparisonResult> {
  // Fetch receipt with currency
  const receipt = await db.receipt.findUnique({
    where: { id: receiptId },
    include: {
      items: {
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  // Fetch catalogue with currency
  const catalogue = await db.catalogue.findUnique({
    where: { id: catalogueId },
    include: {
      items: {
        where: { isActive: true },
      },
    },
  });

  if (!catalogue) {
    throw new Error("Catalogue not found");
  }

  const receiptCurrency = receipt.currency || "USD";
  const catalogueCurrency = catalogue.currency || "GBP";
  const exchangeRate = getExchangeRate(receiptCurrency, catalogueCurrency);

  console.log(`Comparing: Receipt (${receiptCurrency}) vs Catalogue (${catalogueCurrency}), Rate: ${exchangeRate}`);

  // Match products
  const matches = await matchProducts(
    receipt.items.map(item => ({
      id: item.id,
      productName: item.productName,
    })),
    catalogue.items.map(item => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
    }))
  );

  // Build comparison results
  const comparisonItems: ComparisonItemResult[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let totalOvercharge = 0;
  let totalUndercharge = 0;

  for (const receiptItem of receipt.items) {
    const match = matches.get(receiptItem.id);
    const receiptPrice = Number(receiptItem.unitPrice);
    
    // Convert receipt price to catalogue currency
    const receiptPriceConverted = convertCurrency(receiptPrice, receiptCurrency, catalogueCurrency);
    
    if (!match) {
      // No match found
      comparisonItems.push({
        receiptItemId: receiptItem.id,
        catalogueItemId: null,
        receiptPrice,
        receiptPriceConverted,
        cataloguePrice: null,
        priceDifference: null,
        percentageDiff: null,
        exchangeRate,
        matchConfidence: "UNMATCHED",
        status: "UNMATCHED",
      });
      continue;
    }

    const catalogueItem = match.catalogueItemId
      ? catalogue.items.find(c => c.id === match.catalogueItemId)
      : null;

    const cataloguePrice = catalogueItem ? Number(catalogueItem.price) : null;

    let priceDifference: number | null = null;
    let percentageDiff: number | null = null;
    let status: ComparisonStatus = "UNMATCHED";

    if (cataloguePrice !== null) {
      matchedCount++;
      // Compare CONVERTED receipt price with catalogue price
      priceDifference = receiptPriceConverted - cataloguePrice;
      percentageDiff = cataloguePrice > 0 
        ? ((priceDifference / cataloguePrice) * 100)
        : 0;

      // Determine status (allow small tolerance of 2% for exchange rate fluctuations)
      if (Math.abs(percentageDiff) <= 2) {
        status = "MATCH";
      } else if (priceDifference > 0) {
        status = "OVERCHARGE";
        // Calculate total overcharge based on quantity (in catalogue currency)
        totalOvercharge += priceDifference * Number(receiptItem.quantity);
        mismatchCount++;
      } else {
        status = "UNDERCHARGE";
        totalUndercharge += Math.abs(priceDifference) * Number(receiptItem.quantity);
        mismatchCount++;
      }
    }

    comparisonItems.push({
      receiptItemId: receiptItem.id,
      catalogueItemId: match.catalogueItemId,
      receiptPrice,
      receiptPriceConverted: Math.round(receiptPriceConverted * 100) / 100,
      cataloguePrice,
      priceDifference: priceDifference !== null ? Math.round(priceDifference * 100) / 100 : null,
      percentageDiff: percentageDiff !== null ? Math.round(percentageDiff * 100) / 100 : null,
      exchangeRate,
      matchConfidence: match.confidence,
      status,
    });
  }

  return {
    totalItems: receipt.items.length,
    matchedItems: matchedCount,
    mismatches: mismatchCount,
    totalOvercharge: Math.round(totalOvercharge * 100) / 100,
    totalUndercharge: Math.round(totalUndercharge * 100) / 100,
    receiptCurrency,
    catalogueCurrency,
    exchangeRate,
    items: comparisonItems,
  };
}

export async function createComparisonReport(
  receiptId: string,
  catalogueId: string,
  userId: string
): Promise<string> {
  // Verify ownership
  const receipt = await db.receipt.findFirst({
    where: { id: receiptId, userId },
  });

  if (!receipt) {
    throw new Error("Receipt not found or access denied");
  }

  const catalogue = await db.catalogue.findFirst({
    where: { id: catalogueId, userId },
  });

  if (!catalogue) {
    throw new Error("Catalogue not found or access denied");
  }

  // Perform comparison (with currency conversion)
  const comparison = await compareReceiptWithCatalogue(receiptId, catalogueId);

  // Create report in database with currency info
  const report = await db.comparisonReport.create({
    data: {
      receiptId,
      catalogueId,
      totalItems: comparison.totalItems,
      matchedItems: comparison.matchedItems,
      mismatches: comparison.mismatches,
      totalOvercharge: comparison.totalOvercharge,
      totalUndercharge: comparison.totalUndercharge,
      receiptCurrency: comparison.receiptCurrency,
      catalogueCurrency: comparison.catalogueCurrency,
      exchangeRate: comparison.exchangeRate,
      items: {
        create: comparison.items.map(item => ({
          receiptItemId: item.receiptItemId,
          catalogueItemId: item.catalogueItemId,
          receiptPrice: item.receiptPrice,
          receiptPriceConverted: item.receiptPriceConverted,
          cataloguePrice: item.cataloguePrice,
          priceDifference: item.priceDifference,
          percentageDiff: item.percentageDiff,
          exchangeRate: item.exchangeRate,
          matchConfidence: item.matchConfidence,
          status: item.status,
        })),
      },
    },
  });

  return report.id;
}
