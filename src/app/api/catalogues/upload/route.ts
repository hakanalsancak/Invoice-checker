/**
 * Catalogue File Upload API
 * 
 * POST /api/catalogues/upload
 * 
 * Handles file upload, parsing, and returns preview data for column mapping.
 * Accepts .xlsx, .xls, and .csv files up to 10MB.
 * 
 * Query params:
 * - fullData=true: Return all rows instead of just preview (for import)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateFile,
  processExcel,
  getFileType,
} from "@/services/file/excelProcessor";

// Maximum file size: 10MB
const MAX_FILE_SIZE_MB = 10;
const MAX_PREVIEW_ROWS = 20;

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
    const fullData = formData.get("fullData") === "true";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
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

    // Ensure we have data
    if (result.headers.length === 0) {
      return NextResponse.json(
        { success: false, error: "File appears to be empty or has no headers" },
        { status: 400 }
      );
    }

    // =========================================================================
    // RETURN DATA
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileType: getFileType(file.name),
        fileSize: file.size,
        headers: result.headers,
        // Return all data if fullData=true, otherwise just preview
        previewData: fullData ? result.data : result.data.slice(0, MAX_PREVIEW_ROWS),
        allData: fullData ? result.data : undefined,
        totalRows: result.totalRows,
      },
    });

  } catch (error) {
    console.error("Catalogue upload error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process file" 
      },
      { status: 500 }
    );
  }
}
