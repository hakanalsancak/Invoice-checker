import { db } from "@/lib/db";
import { ComparisonStatus, MatchConfidence } from "@/types";
import { getExchangeRate } from "@/lib/currency";

interface ComparisonItemResult {
  invoiceItemId: string;
  catalogueItemId: string | null;
  invoicePrice: number; // Original price in invoice currency
  invoicePriceConverted: number | null; // Converted to catalogue currency
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
  invoiceCurrency: string;
  catalogueCurrency: string;
  exchangeRate: number;
  items: ComparisonItemResult[];
}

export async function compareInvoiceWithCatalogue(
  invoiceId: string,
  catalogueId: string
): Promise<ComparisonResult> {
  // Fetch invoice with currency
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: {
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
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

  const invoiceCurrency = invoice.currency || "USD";
  const catalogueCurrency = catalogue.currency || "GBP";
  const exchangeRate = await getExchangeRate(invoiceCurrency, catalogueCurrency);

  console.log(`Comparing: Invoice (${invoiceCurrency}) vs Catalogue (${catalogueCurrency}), Rate: ${exchangeRate}`);

  // Build comparison results using direct catalogueItemId from invoice items
  // (Users manually select catalogue items when creating invoice items)
  const comparisonItems: ComparisonItemResult[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let totalOvercharge = 0;
  let totalUndercharge = 0;

  for (const invoiceItem of invoice.items) {
    const invoicePrice = Number(invoiceItem.unitPrice);
    
    // Convert invoice price to catalogue currency using the fetched exchange rate
    const invoicePriceConverted = invoicePrice * exchangeRate;
    
    // Use the direct catalogueItemId from the invoice item (user-selected)
    const catalogueItemId = invoiceItem.catalogueItemId;
    
    if (!catalogueItemId) {
      // No catalogue item linked
      comparisonItems.push({
        invoiceItemId: invoiceItem.id,
        catalogueItemId: null,
        invoicePrice,
        invoicePriceConverted,
        cataloguePrice: null,
        priceDifference: null,
        percentageDiff: null,
        exchangeRate,
        matchConfidence: "UNMATCHED",
        status: "UNMATCHED",
      });
      continue;
    }

    const catalogueItem = catalogue.items.find(c => c.id === catalogueItemId);
    const cataloguePrice = catalogueItem ? Number(catalogueItem.price) : null;

    let priceDifference: number | null = null;
    let percentageDiff: number | null = null;
    let status: ComparisonStatus = "UNMATCHED";
    let matchConfidence: MatchConfidence = "UNMATCHED";

    if (cataloguePrice !== null) {
      matchedCount++;
      matchConfidence = "HIGH"; // User manually matched, so confidence is always high
      
      // Compare CONVERTED invoice price with catalogue price
      priceDifference = invoicePriceConverted - cataloguePrice;
      percentageDiff = cataloguePrice > 0 
        ? ((priceDifference / cataloguePrice) * 100)
        : 0;

      // Determine status (allow small tolerance of 2% for exchange rate fluctuations)
      if (Math.abs(percentageDiff) <= 2) {
        status = "MATCH";
      } else if (priceDifference > 0) {
        status = "OVERCHARGE";
        // Calculate total overcharge based on quantity (in catalogue currency)
        totalOvercharge += priceDifference * Number(invoiceItem.quantity);
        mismatchCount++;
      } else {
        status = "UNDERCHARGE";
        totalUndercharge += Math.abs(priceDifference) * Number(invoiceItem.quantity);
        mismatchCount++;
      }
    }

    comparisonItems.push({
      invoiceItemId: invoiceItem.id,
      catalogueItemId,
      invoicePrice,
      invoicePriceConverted: Math.round(invoicePriceConverted * 100) / 100,
      cataloguePrice,
      priceDifference: priceDifference !== null ? Math.round(priceDifference * 100) / 100 : null,
      percentageDiff: percentageDiff !== null ? Math.round(percentageDiff * 100) / 100 : null,
      exchangeRate,
      matchConfidence,
      status,
    });
  }

  return {
    totalItems: invoice.items.length,
    matchedItems: matchedCount,
    mismatches: mismatchCount,
    totalOvercharge: Math.round(totalOvercharge * 100) / 100,
    totalUndercharge: Math.round(totalUndercharge * 100) / 100,
    invoiceCurrency,
    catalogueCurrency,
    exchangeRate,
    items: comparisonItems,
  };
}

export async function createComparisonReport(
  invoiceId: string,
  catalogueId: string,
  userId: string
): Promise<string> {
  // Verify ownership
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!invoice) {
    throw new Error("Invoice not found or access denied");
  }

  const catalogue = await db.catalogue.findFirst({
    where: { id: catalogueId, userId },
  });

  if (!catalogue) {
    throw new Error("Catalogue not found or access denied");
  }

  // Perform comparison (with currency conversion)
  const comparison = await compareInvoiceWithCatalogue(invoiceId, catalogueId);

  // Create report in database with currency info
  const report = await db.comparisonReport.create({
    data: {
      invoiceId,
      catalogueId,
      totalItems: comparison.totalItems,
      matchedItems: comparison.matchedItems,
      mismatches: comparison.mismatches,
      totalOvercharge: comparison.totalOvercharge,
      totalUndercharge: comparison.totalUndercharge,
      invoiceCurrency: comparison.invoiceCurrency,
      catalogueCurrency: comparison.catalogueCurrency,
      exchangeRate: comparison.exchangeRate,
      items: {
        create: comparison.items.map(item => ({
          invoiceItemId: item.invoiceItemId,
          catalogueItemId: item.catalogueItemId,
          invoicePrice: item.invoicePrice,
          invoicePriceConverted: item.invoicePriceConverted,
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
