import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportItem {
  productName: string;
  quantity: number;
  receiptPrice: number;
  receiptPriceConverted: number | null;
  cataloguePrice: number | null;
  priceDifference: number | null;
  percentageDiff: number | null;
}

interface ReportData {
  supplierName: string;
  catalogueName: string;
  receiptDate: string;
  reportDate: string;
  receiptCurrency: string;
  catalogueCurrency: string;
  exchangeRate: number | null;
  totalItems: number;
  matchedItems: number;
  totalOvercharge: number;
  totalUndercharge: number;
  items: ReportItem[];
}

export function exportReportToPDF(report: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [107, 114, 128];
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Price Comparison Report", 14, 25);
  
  // Report info section
  let yPos = 55;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(report.supplierName || "Unknown", 50, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Catalogue:", 110, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(report.catalogueName, 140, yPos);
  
  yPos += 8;
  
  doc.setFont("helvetica", "bold");
  doc.text("Receipt Date:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(report.receiptDate, 50, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Report Date:", 110, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(report.reportDate, 140, yPos);
  
  yPos += 8;
  
  // Currency conversion info
  if (report.receiptCurrency !== report.catalogueCurrency && report.exchangeRate) {
    doc.setFont("helvetica", "bold");
    doc.text("Currency:", 14, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${report.receiptCurrency} → ${report.catalogueCurrency} (Rate: 1 ${report.receiptCurrency} = ${report.exchangeRate.toFixed(4)} ${report.catalogueCurrency})`,
      50, yPos
    );
    yPos += 8;
  }
  
  // Summary boxes
  yPos += 5;
  const boxWidth = 42;
  const boxHeight = 25;
  const boxGap = 5;
  const startX = 14;
  
  // Match Rate box
  doc.setFillColor(240, 253, 244); // Light green
  doc.roundedRect(startX, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setTextColor(...lightGray);
  doc.setFontSize(8);
  doc.text("Match Rate", startX + 4, yPos + 8);
  doc.setTextColor(22, 163, 74); // Green
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const matchRate = report.totalItems > 0 
    ? Math.round((report.matchedItems / report.totalItems) * 100) 
    : 0;
  doc.text(`${matchRate}%`, startX + 4, yPos + 19);
  
  // Total Overcharge box
  doc.setFillColor(254, 242, 242); // Light red
  doc.roundedRect(startX + boxWidth + boxGap, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setTextColor(...lightGray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Total Overcharge", startX + boxWidth + boxGap + 4, yPos + 8);
  doc.setTextColor(220, 38, 38); // Red
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`£${report.totalOvercharge.toFixed(2)}`, startX + boxWidth + boxGap + 4, yPos + 19);
  
  // Total Undercharge box
  doc.setFillColor(239, 246, 255); // Light blue
  doc.roundedRect(startX + (boxWidth + boxGap) * 2, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setTextColor(...lightGray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Total Undercharge", startX + (boxWidth + boxGap) * 2 + 4, yPos + 8);
  doc.setTextColor(37, 99, 235); // Blue
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`£${report.totalUndercharge.toFixed(2)}`, startX + (boxWidth + boxGap) * 2 + 4, yPos + 19);
  
  // Net Difference box
  const netDiff = report.totalOvercharge - report.totalUndercharge;
  doc.setFillColor(netDiff > 0 ? 254 : 240, netDiff > 0 ? 242 : 253, netDiff > 0 ? 242 : 244);
  doc.roundedRect(startX + (boxWidth + boxGap) * 3, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setTextColor(...lightGray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Net Difference", startX + (boxWidth + boxGap) * 3 + 4, yPos + 8);
  doc.setTextColor(netDiff > 0 ? 220 : 22, netDiff > 0 ? 38 : 163, netDiff > 0 ? 38 : 74);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${netDiff >= 0 ? "+" : ""}£${netDiff.toFixed(2)}`, startX + (boxWidth + boxGap) * 3 + 4, yPos + 19);
  
  yPos += boxHeight + 15;
  
  // Table
  const tableData = report.items.map(item => {
    const supplierPrice = `${getCurrencySymbol(report.receiptCurrency)}${item.receiptPrice.toFixed(2)}`;
    const convertedPrice = item.receiptPriceConverted !== null 
      ? `${getCurrencySymbol(report.catalogueCurrency)}${item.receiptPriceConverted.toFixed(2)}`
      : "-";
    const cataloguePrice = item.cataloguePrice !== null
      ? `${getCurrencySymbol(report.catalogueCurrency)}${item.cataloguePrice.toFixed(2)}`
      : "-";
    const difference = item.priceDifference !== null
      ? `${item.priceDifference >= 0 ? "+" : ""}${getCurrencySymbol(report.catalogueCurrency)}${item.priceDifference.toFixed(2)}`
      : "-";
    const percentDiff = item.percentageDiff !== null
      ? `${item.percentageDiff >= 0 ? "+" : ""}${item.percentageDiff.toFixed(1)}%`
      : "-";
    
    return [
      item.productName,
      item.quantity.toString(),
      supplierPrice,
      convertedPrice,
      cataloguePrice,
      difference,
      percentDiff,
    ];
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [[
      "Product Name",
      "Qty",
      `Supplier Price\n(${report.receiptCurrency})`,
      `Converted\n(${report.catalogueCurrency})`,
      `Catalogue Price\n(${report.catalogueCurrency})`,
      `Difference\n(${report.catalogueCurrency})`,
      "Diff %",
    ]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkGray,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 50, halign: "left" },  // Product Name
      1: { cellWidth: 15, halign: "center" }, // Qty
      2: { cellWidth: 28, halign: "right" },  // Supplier Price
      3: { cellWidth: 25, halign: "right" },  // Converted
      4: { cellWidth: 28, halign: "right" },  // Catalogue Price
      5: { cellWidth: 25, halign: "right" },  // Difference
      6: { cellWidth: 18, halign: "right" },  // Diff %
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    didParseCell: (data) => {
      // Color code the difference columns
      if (data.section === "body" && (data.column.index === 5 || data.column.index === 6)) {
        const text = data.cell.text[0];
        if (text && text.startsWith("+") && text !== "+£0.00" && text !== "+0.0%") {
          data.cell.styles.textColor = [220, 38, 38]; // Red for overcharge
          data.cell.styles.fontStyle = "bold";
        } else if (text && text.startsWith("-")) {
          data.cell.styles.textColor = [37, 99, 235]; // Blue for undercharge
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setTextColor(...lightGray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated by Invoice Check • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }
  
  // Save the PDF
  const fileName = `Price-Report_${report.supplierName?.replace(/\s+/g, "-") || "Unknown"}_${report.reportDate.replace(/,\s*/g, "-")}.pdf`;
  doc.save(fileName);
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    TRY: "₺",
  };
  return symbols[currency] || currency;
}
