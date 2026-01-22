import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRate } from "@/lib/currency";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: invoiceId } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get invoice with items and linked catalogues
    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        userId: session.user.id,
      },
      include: {
        items: {
          include: {
            catalogueItem: {
              include: {
                catalogue: {
                  select: { id: true, currency: true },
                },
              },
            },
          },
        },
        catalogues: {
          include: {
            catalogue: {
              select: { id: true, name: true, currency: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invoice has no items to verify" },
        { status: 400 }
      );
    }

    // Get the first linked catalogue for the report
    const linkedCatalogue = invoice.catalogues[0]?.catalogue;
    if (!linkedCatalogue) {
      return NextResponse.json(
        { success: false, error: "Invoice is not linked to any catalogue" },
        { status: 400 }
      );
    }

    const invoiceCurrency = invoice.currency || "USD";
    const catalogueCurrency = linkedCatalogue.currency || "GBP";
    
    // Get exchange rate if currencies differ
    const exchangeRate = invoiceCurrency !== catalogueCurrency
      ? await getExchangeRate(invoiceCurrency, catalogueCurrency)
      : 1;

    // Calculate comparison for each item
    let totalOvercharge = 0;
    let totalUndercharge = 0;
    let matchedItems = 0;
    let mismatches = 0;

    const comparisonItems = invoice.items.map(item => {
      const catalogueItem = item.catalogueItem;
      
      if (!catalogueItem) {
        mismatches++;
        return {
          invoiceItemId: item.id,
          catalogueItemId: null,
          invoicePrice: Number(item.unitPrice),
          invoicePriceConverted: null,
          cataloguePrice: null,
          priceDifference: null,
          percentageDiff: null,
          exchangeRate: null,
          matchConfidence: "UNMATCHED" as const,
          status: "UNMATCHED" as const,
        };
      }

      const invoicePrice = Number(item.unitPrice);
      const cataloguePrice = Number(catalogueItem.price);
      
      // Convert invoice price to catalogue currency
      const convertedPrice = invoicePrice * exchangeRate;
      
      // Calculate difference
      const priceDiff = convertedPrice - cataloguePrice;
      const percentDiff = cataloguePrice > 0 
        ? ((convertedPrice - cataloguePrice) / cataloguePrice) * 100 
        : 0;

      // Determine status (5% tolerance)
      let status: "MATCH" | "OVERCHARGE" | "UNDERCHARGE";
      if (Math.abs(percentDiff) <= 5) {
        status = "MATCH";
        matchedItems++;
      } else if (priceDiff > 0) {
        status = "OVERCHARGE";
        totalOvercharge += priceDiff * Number(item.quantity);
        mismatches++;
      } else {
        status = "UNDERCHARGE";
        totalUndercharge += Math.abs(priceDiff) * Number(item.quantity);
        mismatches++;
      }

      return {
        invoiceItemId: item.id,
        catalogueItemId: catalogueItem.id,
        invoicePrice,
        invoicePriceConverted: convertedPrice,
        cataloguePrice,
        priceDifference: priceDiff,
        percentageDiff: percentDiff,
        exchangeRate: invoiceCurrency !== catalogueCurrency ? exchangeRate : null,
        matchConfidence: "EXACT" as const, // Direct link = exact match
        status,
      };
    });

    // Create the report
    const report = await db.comparisonReport.create({
      data: {
        invoiceId,
        catalogueId: linkedCatalogue.id,
        totalItems: invoice.items.length,
        matchedItems,
        mismatches,
        totalOvercharge,
        totalUndercharge,
        invoiceCurrency,
        catalogueCurrency,
        exchangeRate: invoiceCurrency !== catalogueCurrency ? exchangeRate : null,
        items: {
          create: comparisonItems,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { reportId: report.id },
    });
  } catch (error) {
    console.error("Verify invoice error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to verify invoice" 
      },
      { status: 500 }
    );
  }
}
