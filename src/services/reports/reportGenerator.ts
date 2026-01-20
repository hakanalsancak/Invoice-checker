import { db } from "@/lib/db";
import { ComparisonReportWithDetails } from "@/types";

export async function getReportWithDetails(
  reportId: string,
  userId: string
): Promise<ComparisonReportWithDetails | null> {
  const report = await db.comparisonReport.findFirst({
    where: {
      id: reportId,
      receipt: { userId },
    },
    include: {
      receipt: {
        select: {
          id: true,
          supplierName: true,
          originalFileName: true,
          receiptDate: true,
          currency: true,
        },
      },
      catalogue: {
        select: {
          id: true,
          name: true,
          currency: true,
        },
      },
      items: {
        include: {
          receiptItem: {
            select: {
              productName: true,
              quantity: true,
              unit: true,
            },
          },
          catalogueItem: {
            select: {
              productName: true,
              sku: true,
              unit: true,
            },
          },
        },
        orderBy: {
          receiptItem: {
            lineNumber: "asc",
          },
        },
      },
    },
  });

  if (!report) {
    return null;
  }

  return {
    ...report,
    receiptCurrency: report.receiptCurrency || report.receipt.currency || "USD",
    catalogueCurrency: report.catalogueCurrency || report.catalogue.currency || "GBP",
    items: report.items.map(item => ({
      ...item,
      receiptItem: item.receiptItem,
      catalogueItem: item.catalogueItem,
    })),
  };
}

export async function getUserReports(userId: string) {
  return db.comparisonReport.findMany({
    where: {
      receipt: { userId },
    },
    include: {
      receipt: {
        select: {
          id: true,
          supplierName: true,
          originalFileName: true,
          receiptDate: true,
        },
      },
      catalogue: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function deleteReport(reportId: string, userId: string): Promise<boolean> {
  const report = await db.comparisonReport.findFirst({
    where: {
      id: reportId,
      receipt: { userId },
    },
  });

  if (!report) {
    return false;
  }

  await db.comparisonReport.delete({
    where: { id: reportId },
  });

  return true;
}

// Generate summary statistics for a report
export function generateReportSummary(report: ComparisonReportWithDetails) {
  const matchedPercentage = report.totalItems > 0
    ? Math.round((report.matchedItems / report.totalItems) * 100)
    : 0;

  const overchargeItems = report.items.filter(item => item.status === "OVERCHARGE");
  const underchargeItems = report.items.filter(item => item.status === "UNDERCHARGE");
  const unmatchedItems = report.items.filter(item => item.status === "UNMATCHED");

  return {
    matchedPercentage,
    overchargeCount: overchargeItems.length,
    underchargeCount: underchargeItems.length,
    unmatchedCount: unmatchedItems.length,
    netDifference: Number(report.totalOvercharge) - Number(report.totalUndercharge),
    topOvercharges: overchargeItems
      .sort((a, b) => Math.abs(Number(b.priceDifference) || 0) - Math.abs(Number(a.priceDifference) || 0))
      .slice(0, 5),
  };
}

// Export report data as CSV
export function exportReportToCSV(report: ComparisonReportWithDetails): string {
  const receiptCurrency = report.receiptCurrency || "USD";
  const catalogueCurrency = report.catalogueCurrency || "GBP";
  const hasDifferentCurrencies = receiptCurrency !== catalogueCurrency;

  const headers = [
    "Product Name (Receipt)",
    "Product Name (Catalogue)",
    "SKU",
    "Quantity",
    "Unit",
    `Receipt Price (${receiptCurrency})`,
    ...(hasDifferentCurrencies ? [`Converted Price (${catalogueCurrency})`] : []),
    `Catalogue Price (${catalogueCurrency})`,
    `Difference (${catalogueCurrency})`,
    "% Difference",
    "Status",
    "Match Confidence",
    ...(hasDifferentCurrencies ? ["Exchange Rate"] : []),
  ];

  const rows = report.items.map(item => [
    item.receiptItem.productName,
    item.catalogueItem?.productName || "N/A",
    item.catalogueItem?.sku || "N/A",
    String(item.receiptItem.quantity),
    item.receiptItem.unit || "N/A",
    String(item.receiptPrice),
    ...(hasDifferentCurrencies ? [item.receiptPriceConverted !== null ? String(item.receiptPriceConverted) : "N/A"] : []),
    item.cataloguePrice !== null ? String(item.cataloguePrice) : "N/A",
    item.priceDifference !== null ? String(item.priceDifference) : "N/A",
    item.percentageDiff !== null ? `${item.percentageDiff}%` : "N/A",
    item.status,
    item.matchConfidence,
    ...(hasDifferentCurrencies ? [item.exchangeRate !== null ? String(item.exchangeRate) : "N/A"] : []),
  ]);

  const csvContent = [
    // Add metadata header
    `# Report ID: ${report.id}`,
    `# Created: ${report.createdAt}`,
    `# Receipt Currency: ${receiptCurrency}`,
    `# Catalogue Currency: ${catalogueCurrency}`,
    ...(report.exchangeRate ? [`# Exchange Rate: 1 ${receiptCurrency} = ${report.exchangeRate} ${catalogueCurrency}`] : []),
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}
