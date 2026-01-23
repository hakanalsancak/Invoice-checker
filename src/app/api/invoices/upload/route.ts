/**
 * Invoice File Upload API
 * 
 * POST /api/invoices/upload
 * 
 * Handles file upload for invoice items, parses the file,
 * and returns data with match suggestions from linked catalogues.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  validateFile,
  processExcel,
  getFileType,
  normalizeProductName,
  parsePrice,
} from "@/services/file/excelProcessor";
import {
  FuzzyMatcher,
  type CatalogueItemForMatching,
  type InvoiceItemForMatching,
} from "@/services/matching/fuzzyMatcher";

// Maximum file size: 10MB
const MAX_FILE_SIZE_MB = 10;
const MAX_PREVIEW_ROWS = 100; // More rows for invoices

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
    // PARSE FORM DATA
    // =========================================================================
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const catalogueIdsJson = formData.get("catalogueIds") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!catalogueIdsJson) {
      return NextResponse.json(
        { success: false, error: "No catalogues specified" },
        { status: 400 }
      );
    }

    let catalogueIds: string[];
    try {
      catalogueIds = JSON.parse(catalogueIdsJson);
      if (!Array.isArray(catalogueIds) || catalogueIds.length === 0) {
        throw new Error("Invalid catalogue IDs");
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid catalogue IDs format" },
        { status: 400 }
      );
    }

    // =========================================================================
    // VALIDATE FILE TYPE AND SIZE
    // =========================================================================
    const validation = validateFile(file.name, file.size, MAX_FILE_SIZE_MB);
    
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // =========================================================================
    // FETCH CATALOGUE ITEMS
    // =========================================================================
    const catalogues = await db.catalogue.findMany({
      where: {
        id: { in: catalogueIds },
        userId: session.user.id,
      },
      include: {
        items: {
          where: { isActive: true },
          select: {
            id: true,
            productName: true,
            sku: true,
            price: true,
            unit: true,
            category: true,
          },
        },
      },
    });

    if (catalogues.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid catalogues found" },
        { status: 400 }
      );
    }

    // Flatten all catalogue items
    const allCatalogueItems: CatalogueItemForMatching[] = catalogues.flatMap(
      catalogue => catalogue.items.map(item => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        price: Number(item.price),
        unit: item.unit,
        category: item.category,
      }))
    );

    if (allCatalogueItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Selected catalogues have no items" },
        { status: 400 }
      );
    }

    // =========================================================================
    // PARSE FILE
    // =========================================================================
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processExcel(buffer);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to parse file" },
        { status: 400 }
      );
    }

    if (result.headers.length === 0 || result.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "File appears to be empty" },
        { status: 400 }
      );
    }

    // =========================================================================
    // RETURN PREVIEW DATA
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileType: getFileType(file.name),
        fileSize: file.size,
        headers: result.headers,
        previewData: result.data.slice(0, MAX_PREVIEW_ROWS),
        totalRows: result.totalRows,
        catalogueItemCount: allCatalogueItems.length,
      },
    });

  } catch (error) {
    console.error("Invoice upload error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process file" 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/upload
 * 
 * Apply column mapping and get match suggestions
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: {
      data?: Record<string, unknown>[];
      mapping?: {
        product_name: string;
        quantity: string;
        unit_price: string;
        total_price?: string;
        unit?: string;
      };
      catalogueIds?: string[];
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate request
    if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data provided" },
        { status: 400 }
      );
    }

    if (!body.mapping?.product_name || !body.mapping?.quantity || !body.mapping?.unit_price) {
      return NextResponse.json(
        { success: false, error: "Product name, quantity, and unit price columns are required" },
        { status: 400 }
      );
    }

    if (!body.catalogueIds || body.catalogueIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No catalogues specified" },
        { status: 400 }
      );
    }

    // Fetch catalogue items
    const catalogues = await db.catalogue.findMany({
      where: {
        id: { in: body.catalogueIds },
        userId: session.user.id,
      },
      include: {
        items: {
          where: { isActive: true },
          select: {
            id: true,
            productName: true,
            sku: true,
            price: true,
            unit: true,
            category: true,
          },
        },
      },
    });

    const allCatalogueItems: CatalogueItemForMatching[] = catalogues.flatMap(
      catalogue => catalogue.items.map(item => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        price: Number(item.price),
        unit: item.unit,
        category: item.category,
      }))
    );

    // Apply mapping and create invoice items
    const mapping = body.mapping;
    const invoiceItems: InvoiceItemForMatching[] = body.data.map((row, index) => {
      const productName = normalizeProductName(row[mapping.product_name] as string);
      const quantity = parsePrice(row[mapping.quantity]) || 0;
      const unitPrice = parsePrice(row[mapping.unit_price]) || 0;
      const totalPrice = mapping.total_price 
        ? parsePrice(row[mapping.total_price]) || (quantity * unitPrice)
        : quantity * unitPrice;
      const unit = mapping.unit 
        ? normalizeProductName(row[mapping.unit] as string) || null
        : null;

      return {
        rowIndex: index + 1,
        productName,
        quantity,
        unitPrice,
        totalPrice,
        unit,
      };
    }).filter(item => item.productName && item.productName.trim() !== '');

    // Create fuzzy matcher and find suggestions
    const matcher = new FuzzyMatcher(allCatalogueItems);
    const itemsWithSuggestions = matcher.findMatchesForItems(invoiceItems);

    // Calculate stats
    const autoMatchedCount = itemsWithSuggestions.filter(i => i.autoMatched).length;
    const needsReviewCount = itemsWithSuggestions.filter(
      i => !i.autoMatched && i.suggestions.length > 0
    ).length;
    const unmatchedCount = itemsWithSuggestions.filter(
      i => i.suggestions.length === 0
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        items: itemsWithSuggestions,
        stats: {
          totalItems: itemsWithSuggestions.length,
          autoMatched: autoMatchedCount,
          needsReview: needsReviewCount,
          unmatched: unmatchedCount,
        },
        catalogueItems: allCatalogueItems, // For manual search
      },
    });

  } catch (error) {
    console.error("Invoice mapping error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process mapping" 
      },
      { status: 500 }
    );
  }
}
