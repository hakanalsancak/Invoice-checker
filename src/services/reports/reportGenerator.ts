import { db } from "@/lib/db";
import { ComparisonReportWithDetails } from "@/types";

export async function getReportWithDetails(
  reportId: string,
  userId: string
): Promise<ComparisonReportWithDetails | null> {
  const report = await db.comparisonReport.findFirst({
    where: {
      id: reportId,
      invoice: { userId },
    },
    include: {
      invoice: {
        select: {
          id: true,
          supplierName: true,
          originalFileName: true,
          invoiceDate: true,
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
          invoiceItem: {
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
          invoiceItem: {
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
    invoiceCurrency: report.invoiceCurrency || report.invoice.currency || "USD",
    catalogueCurrency: report.catalogueCurrency || report.catalogue.currency || "GBP",
    items: report.items.map(item => ({
      ...item,
      invoiceItem: item.invoiceItem,
      catalogueItem: item.catalogueItem,
    })),
  };
}

export async function getUserReports(userId: string) {
  return db.comparisonReport.findMany({
    where: {
      invoice: { userId },
    },
    include: {
      invoice: {
        select: {
          id: true,
          supplierName: true,
          originalFileName: true,
          invoiceDate: true,
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
      invoice: { userId },
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
  const invoiceCurrency = report.invoiceCurrency || "USD";
  const catalogueCurrency = report.catalogueCurrency || "GBP";
  const hasDifferentCurrencies = invoiceCurrency !== catalogueCurrency;

  const headers = [
    "Product Name (Invoice)",
    "Product Name (Catalogue)",
    "SKU",
    "Quantity",
    "Unit",
    `Invoice Price (${invoiceCurrency})`,
    ...(hasDifferentCurrencies ? [`Converted Price (${catalogueCurrency})`] : []),
    `Catalogue Price (${catalogueCurrency})`,
    `Difference (${catalogueCurrency})`,
    "% Difference",
    "Status",
    "Match Confidence",
    ...(hasDifferentCurrencies ? ["Exchange Rate"] : []),
  ];

  const rows = report.items.map(item => [
    item.invoiceItem.productName,
    item.catalogueItem?.productName || "N/A",
    item.catalogueItem?.sku || "N/A",
    String(item.invoiceItem.quantity),
    item.invoiceItem.unit || "N/A",
    String(item.invoicePrice),
    ...(hasDifferentCurrencies ? [item.invoicePriceConverted !== null ? String(item.invoicePriceConverted) : "N/A"] : []),
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
    `# Invoice Currency: ${invoiceCurrency}`,
    `# Catalogue Currency: ${catalogueCurrency}`,
    ...(report.exchangeRate ? [`# Exchange Rate: 1 ${invoiceCurrency} = ${report.exchangeRate} ${catalogueCurrency}`] : []),
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}
