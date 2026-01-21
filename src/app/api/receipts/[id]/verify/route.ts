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
    const { id: receiptId } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get receipt with items and linked catalogues
    const receipt = await db.receipt.findFirst({
      where: {
        id: receiptId,
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

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    if (receipt.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Receipt has no items to verify" },
        { status: 400 }
      );
    }

    // Get the first linked catalogue for the report
    const linkedCatalogue = receipt.catalogues[0]?.catalogue;
    if (!linkedCatalogue) {
      return NextResponse.json(
        { success: false, error: "Receipt is not linked to any catalogue" },
        { status: 400 }
      );
    }

    const receiptCurrency = receipt.currency || "USD";
    const catalogueCurrency = linkedCatalogue.currency || "GBP";
    
    // Get exchange rate if currencies differ
    const exchangeRate = receiptCurrency !== catalogueCurrency
      ? await getExchangeRate(receiptCurrency, catalogueCurrency)
      : 1;

    // Calculate comparison for each item
    let totalOvercharge = 0;
    let totalUndercharge = 0;
    let matchedItems = 0;
    let mismatches = 0;

    const comparisonItems = receipt.items.map(item => {
      const catalogueItem = item.catalogueItem;
      
      if (!catalogueItem) {
        mismatches++;
        return {
          receiptItemId: item.id,
          catalogueItemId: null,
          receiptPrice: Number(item.unitPrice),
          receiptPriceConverted: null,
          cataloguePrice: null,
          priceDifference: null,
          percentageDiff: null,
          exchangeRate: null,
          matchConfidence: "UNMATCHED" as const,
          status: "UNMATCHED" as const,
        };
      }

      const receiptPrice = Number(item.unitPrice);
      const cataloguePrice = Number(catalogueItem.price);
      
      // Convert receipt price to catalogue currency
      const convertedPrice = receiptPrice * exchangeRate;
      
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
        receiptItemId: item.id,
        catalogueItemId: catalogueItem.id,
        receiptPrice,
        receiptPriceConverted: convertedPrice,
        cataloguePrice,
        priceDifference: priceDiff,
        percentageDiff: percentDiff,
        exchangeRate: receiptCurrency !== catalogueCurrency ? exchangeRate : null,
        matchConfidence: "EXACT" as const, // Direct link = exact match
        status,
      };
    });

    // Create the report
    const report = await db.comparisonReport.create({
      data: {
        receiptId,
        catalogueId: linkedCatalogue.id,
        totalItems: receipt.items.length,
        matchedItems,
        mismatches,
        totalOvercharge,
        totalUndercharge,
        receiptCurrency,
        catalogueCurrency,
        exchangeRate: receiptCurrency !== catalogueCurrency ? exchangeRate : null,
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
    console.error("Verify receipt error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to verify receipt" 
      },
      { status: 500 }
    );
  }
}
