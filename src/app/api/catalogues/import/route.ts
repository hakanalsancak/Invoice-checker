/**
 * Catalogue Import API
 * 
 * POST /api/catalogues/import
 * 
 * Validates mapped data and imports products into the catalogue.
 * Supports upsert: updates existing products (by SKU) or inserts new ones.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyColumnMapping,
  validateMappedData,
  type ColumnMapping,
  type ExcelRow,
  type ValidationError,
} from "@/services/file/excelProcessor";


// ============================================================================
// TYPES
// ============================================================================

interface ImportResult {
  catalogueId: string;
  catalogueName: string;
  totalProcessed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
  summary: {
    newProducts: string[];
    updatedProducts: string[];
    skippedProducts: string[];
  };
}

// ============================================================================
// API HANDLER
// ============================================================================

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
    // PARSE AND VALIDATE REQUEST (manual validation, no zod)
    // =========================================================================
    let body: {
      catalogueName?: string;
      currency?: string;
      fileName?: string;
      data?: unknown[];
      mapping?: Record<string, string>;
      skipDuplicates?: boolean;
    };
    
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.catalogueName || typeof body.catalogueName !== 'string') {
      return NextResponse.json(
        { success: false, error: "Catalogue name is required" },
        { status: 400 }
      );
    }

    if (!body.fileName || typeof body.fileName !== 'string') {
      return NextResponse.json(
        { success: false, error: "File name is required" },
        { status: 400 }
      );
    }

    if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data to import" },
        { status: 400 }
      );
    }

    if (!body.mapping || typeof body.mapping !== 'object') {
      return NextResponse.json(
        { success: false, error: "Mapping is required" },
        { status: 400 }
      );
    }

    if (!body.mapping.product_name || !body.mapping.unit_price) {
      return NextResponse.json(
        { success: false, error: "Product name and price columns are required" },
        { status: 400 }
      );
    }

    const catalogueName = body.catalogueName;
    const currency = body.currency || "GBP";
    const fileName = body.fileName;
    const data = body.data;
    const mapping = body.mapping;
    const skipDuplicates = body.skipDuplicates || false;

    // =========================================================================
    // APPLY MAPPING AND VALIDATE DATA
    // =========================================================================
    const safeMapping: ColumnMapping = {
      product_name: mapping.product_name,
      product_code: mapping.product_code || undefined,
      unit_price: mapping.unit_price,
      unit: mapping.unit || undefined,
      category: mapping.category || undefined,
    };
    const mappedData = applyColumnMapping(data as ExcelRow[], safeMapping);
    const validation = validateMappedData(mappedData);

    // If there are validation errors, return them
    if (!validation.isValid && !skipDuplicates) {
      // Filter out duplicate errors if skipDuplicates is true
      const criticalErrors = validation.errors.filter(e => 
        e.field !== "product_code" || !validation.duplicateCodes.includes(e.value || "")
      );

      if (criticalErrors.length > 0) {
        return NextResponse.json({
          success: false,
          error: "Validation failed",
          validationResult: {
            isValid: false,
            errors: validation.errors.slice(0, 50), // Limit errors returned
            totalErrors: validation.errors.length,
            duplicateCodes: validation.duplicateCodes,
            validRowCount: validation.validRowCount,
            invalidRowCount: validation.invalidRowCount,
          },
        }, { status: 400 });
      }
    }

    // =========================================================================
    // CREATE OR GET CATALOGUE
    // =========================================================================
    const catalogue = await db.catalogue.create({
      data: {
        userId: session.user.id,
        name: catalogueName,
        originalFileName: fileName,
        currency: currency,
        language: "en",
        status: "PROCESSING",
      },
    });

    // =========================================================================
    // IMPORT PRODUCTS
    // =========================================================================
    const result = await importProducts(
      catalogue.id,
      mappedData,
      skipDuplicates,
      validation.duplicateCodes
    );

    // =========================================================================
    // UPDATE CATALOGUE STATUS
    // =========================================================================
    await db.catalogue.update({
      where: { id: catalogue.id },
      data: { status: "COMPLETED" },
    });

    // =========================================================================
    // RETURN RESULT
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        catalogueId: catalogue.id,
        catalogueName: catalogue.name,
        totalProcessed: result.totalProcessed,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.slice(0, 20), // Limit errors in response
        totalErrors: result.errors.length,
      },
    });

  } catch (error) {
    console.error("Catalogue import error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to import catalogue" 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// IMPORT LOGIC
// ============================================================================

/**
 * Import products into the catalogue
 * Uses upsert logic: update if SKU exists, insert if new
 */
async function importProducts(
  catalogueId: string,
  mappedData: ReturnType<typeof applyColumnMapping>,
  skipDuplicates: boolean,
  duplicateCodes: string[]
): Promise<{
  totalProcessed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
}> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: ValidationError[] = [];
  const seenCodes = new Set<string>();

  for (const row of mappedData) {
    try {
      // Skip rows with missing required data
      if (!row.product_name || row.unit_price === null) {
        skipped++;
        continue;
      }

      // Handle duplicates within the file
      if (row.product_code) {
        if (duplicateCodes.includes(row.product_code)) {
          if (skipDuplicates) {
            // Keep only the first occurrence
            if (seenCodes.has(row.product_code)) {
              skipped++;
              continue;
            }
          }
          seenCodes.add(row.product_code);
        }
      }

      // Check if product with this SKU already exists in catalogue
      let existingItem = null;
      if (row.product_code) {
        existingItem = await db.catalogueItem.findFirst({
          where: {
            catalogueId,
            sku: row.product_code,
          },
        });
      }

      if (existingItem) {
        // Update existing product
        await db.catalogueItem.update({
          where: { id: existingItem.id },
          data: {
            productName: row.product_name,
            price: row.unit_price,
            unit: row.unit,
            category: row.category,
            updatedAt: new Date(),
          },
        });
        updated++;
      } else {
        // Insert new product
        await db.catalogueItem.create({
          data: {
            catalogueId,
            productName: row.product_name,
            sku: row.product_code,
            price: row.unit_price,
            unit: row.unit,
            category: row.category,
          },
        });
        imported++;
      }
    } catch (error) {
      console.error(`Error importing row ${row.rowIndex}:`, error);
      errors.push({
        row: row.rowIndex,
        field: "import",
        value: row.product_name,
        message: error instanceof Error ? error.message : "Failed to import row",
      });
      skipped++;
    }
  }

  return {
    totalProcessed: mappedData.length,
    imported,
    updated,
    skipped,
    errors,
  };
}

// ============================================================================
// VALIDATE ONLY ENDPOINT
// ============================================================================

/**
 * Validate mapped data without importing
 * Useful for preview/confirmation step
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

    let body: { data?: unknown[]; mapping?: Record<string, string> };
    try {
      body = await request.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Manual validation (no zod)
    if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data to validate" },
        { status: 400 }
      );
    }

    if (!body.mapping || typeof body.mapping !== 'object') {
      return NextResponse.json(
        { success: false, error: "Mapping is required" },
        { status: 400 }
      );
    }

    const mapping = body.mapping;
    
    if (!mapping.product_name || typeof mapping.product_name !== 'string') {
      return NextResponse.json(
        { success: false, error: "Product name column is required" },
        { status: 400 }
      );
    }

    if (!mapping.unit_price || typeof mapping.unit_price !== 'string') {
      return NextResponse.json(
        { success: false, error: "Price column is required" },
        { status: 400 }
      );
    }

    // Build safe mapping
    const safeMapping: ColumnMapping = {
      product_name: mapping.product_name,
      product_code: mapping.product_code || undefined,
      unit_price: mapping.unit_price,
      unit: mapping.unit || undefined,
      category: mapping.category || undefined,
    };
    
    const mappedData = applyColumnMapping(body.data as ExcelRow[], safeMapping);
    const validation = validateMappedData(mappedData);

    return NextResponse.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors.slice(0, 50),
        totalErrors: validation.errors.length,
        duplicateCodes: validation.duplicateCodes,
        validRowCount: validation.validRowCount,
        invalidRowCount: validation.invalidRowCount,
        previewData: mappedData.slice(0, 20).map(row => ({
          rowIndex: row.rowIndex,
          product_name: row.product_name,
          product_code: row.product_code,
          unit_price: row.unit_price,
          unit: row.unit,
          category: row.category,
        })),
      },
    });
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to validate data" 
      },
      { status: 500 }
    );
  }
}
