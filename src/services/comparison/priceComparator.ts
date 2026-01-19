import { db } from "@/lib/db";
import { matchProducts } from "@/services/ai/productMatcher";
import { ComparisonStatus, MatchConfidence } from "@/types";

interface ComparisonItemResult {
  receiptItemId: string;
  catalogueItemId: string | null;
  receiptPrice: number;
  cataloguePrice: number | null;
  priceDifference: number | null;
  percentageDiff: number | null;
  matchConfidence: MatchConfidence;
  status: ComparisonStatus;
}

export async function compareReceiptWithCatalogue(
  receiptId: string,
  catalogueId: string
): Promise<{
  totalItems: number;
  matchedItems: number;
  mismatches: number;
  totalOvercharge: number;
  totalUndercharge: number;
  items: ComparisonItemResult[];
}> {
  // Fetch receipt items
  const receiptItems = await db.receiptItem.findMany({
    where: { receiptId },
    orderBy: { lineNumber: "asc" },
  });

  // Fetch catalogue items
  const catalogueItems = await db.catalogueItem.findMany({
    where: { 
      catalogueId,
      isActive: true,
    },
  });

  // Match products
  const matches = await matchProducts(
    receiptItems.map(item => ({
      id: item.id,
      productName: item.productName,
    })),
    catalogueItems.map(item => ({
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

  for (const receiptItem of receiptItems) {
    const match = matches.get(receiptItem.id);
    
    if (!match) {
      // No match found
      comparisonItems.push({
        receiptItemId: receiptItem.id,
        catalogueItemId: null,
        receiptPrice: Number(receiptItem.unitPrice),
        cataloguePrice: null,
        priceDifference: null,
        percentageDiff: null,
        matchConfidence: "UNMATCHED",
        status: "UNMATCHED",
      });
      continue;
    }

    const catalogueItem = match.catalogueItemId
      ? catalogueItems.find(c => c.id === match.catalogueItemId)
      : null;

    const receiptPrice = Number(receiptItem.unitPrice);
    const cataloguePrice = catalogueItem ? Number(catalogueItem.price) : null;

    let priceDifference: number | null = null;
    let percentageDiff: number | null = null;
    let status: ComparisonStatus = "UNMATCHED";

    if (cataloguePrice !== null) {
      matchedCount++;
      priceDifference = receiptPrice - cataloguePrice;
      percentageDiff = cataloguePrice > 0 
        ? ((priceDifference / cataloguePrice) * 100)
        : 0;

      // Determine status (allow small tolerance of 0.5%)
      if (Math.abs(percentageDiff) <= 0.5) {
        status = "MATCH";
      } else if (priceDifference > 0) {
        status = "OVERCHARGE";
        // Calculate total overcharge based on quantity
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
      cataloguePrice,
      priceDifference,
      percentageDiff: percentageDiff !== null ? Math.round(percentageDiff * 100) / 100 : null,
      matchConfidence: match.confidence,
      status,
    });
  }

  return {
    totalItems: receiptItems.length,
    matchedItems: matchedCount,
    mismatches: mismatchCount,
    totalOvercharge: Math.round(totalOvercharge * 100) / 100,
    totalUndercharge: Math.round(totalUndercharge * 100) / 100,
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

  // Perform comparison
  const comparison = await compareReceiptWithCatalogue(receiptId, catalogueId);

  // Create report in database
  const report = await db.comparisonReport.create({
    data: {
      receiptId,
      catalogueId,
      totalItems: comparison.totalItems,
      matchedItems: comparison.matchedItems,
      mismatches: comparison.mismatches,
      totalOvercharge: comparison.totalOvercharge,
      totalUndercharge: comparison.totalUndercharge,
      items: {
        create: comparison.items.map(item => ({
          receiptItemId: item.receiptItemId,
          catalogueItemId: item.catalogueItemId,
          receiptPrice: item.receiptPrice,
          cataloguePrice: item.cataloguePrice,
          priceDifference: item.priceDifference,
          percentageDiff: item.percentageDiff,
          matchConfidence: item.matchConfidence,
          status: item.status,
        })),
      },
    },
  });

  return report.id;
}
