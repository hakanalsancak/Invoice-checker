/**
 * Invoice Import API
 * 
 * POST /api/invoices/import
 * 
 * Saves matched invoice items to the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface ImportItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string | null;
  catalogueItemId: string | null; // null if unmatched
}

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // =========================================================================
    // PARSE REQUEST
    // =========================================================================
    let body: {
      invoiceId?: string;
      supplierName?: string;
      invoiceDate?: string;
      currency?: string;
      catalogueIds?: string[];
      items?: ImportItem[];
      // For creating new invoice
      createNew?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // =========================================================================
    // VALIDATE REQUEST
    // =========================================================================
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items to import" },
        { status: 400 }
      );
    }

    if (!body.catalogueIds || body.catalogueIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No catalogues specified" },
        { status: 400 }
      );
    }

    // =========================================================================
    // CREATE OR GET INVOICE
    // =========================================================================
    let invoice;

    if (body.invoiceId) {
      // Add items to existing invoice
      invoice = await db.invoice.findFirst({
        where: {
          id: body.invoiceId,
          userId: session.user.id,
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { success: false, error: "Invoice not found" },
          { status: 404 }
        );
      }
    } else {
      // Create new invoice
      if (!body.supplierName) {
        return NextResponse.json(
          { success: false, error: "Supplier name is required for new invoice" },
          { status: 400 }
        );
      }

      invoice = await db.invoice.create({
        data: {
          userId: session.user.id,
          supplierName: body.supplierName,
          originalFileName: "Excel Import",
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
          currency: body.currency || "USD",
          status: "COMPLETED",
        },
      });

      // Link catalogues to invoice
      await db.invoiceCatalogue.createMany({
        data: body.catalogueIds.map(catalogueId => ({
          invoiceId: invoice.id,
          catalogueId,
        })),
        skipDuplicates: true,
      });
    }

    // =========================================================================
    // IMPORT ITEMS
    // =========================================================================
    let importedCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Get the current max line number
    const existingItems = await db.invoiceItem.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { lineNumber: 'desc' },
      take: 1,
    });
    let lineNumber = existingItems.length > 0 ? existingItems[0].lineNumber : 0;

    for (const item of body.items) {
      lineNumber++;

      try {
        await db.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            catalogueItemId: item.catalogueItemId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            lineNumber,
          },
        });

        importedCount++;
        if (item.catalogueItemId) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }
      } catch (error) {
        console.error(`Error importing item ${item.productName}:`, error);
      }
    }

    // Update invoice total
    const allItems = await db.invoiceItem.findMany({
      where: { invoiceId: invoice.id },
    });
    const totalAmount = allItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    );

    await db.invoice.update({
      where: { id: invoice.id },
      data: { totalAmount },
    });

    // =========================================================================
    // RETURN RESULT
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        supplierName: invoice.supplierName,
        totalImported: importedCount,
        matchedItems: matchedCount,
        unmatchedItems: unmatchedCount,
        totalAmount,
      },
    });

  } catch (error) {
    console.error("Invoice import error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to import invoice" 
      },
      { status: 500 }
    );
  }
}
