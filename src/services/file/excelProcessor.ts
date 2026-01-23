/**
 * Excel and CSV File Processor
 * 
 * Handles parsing of .xlsx, .xls, and .csv files for catalogue import.
 * Extracts headers, data rows, and provides preview functionality.
 */

import * as XLSX from "xlsx";

// ============================================================================
// TYPES
// ============================================================================

export interface ExcelRow {
  [key: string]: string | number | null;
}

export interface ExcelProcessResult {
  data: ExcelRow[];
  headers: string[];
  sheetName: string;
  totalRows: number;
  success: boolean;
  error?: string;
}

export interface FilePreviewResult {
  headers: string[];
  previewData: ExcelRow[];
  totalRows: number;
  fileName: string;
  fileType: "xlsx" | "xls" | "csv";
  success: boolean;
  error?: string;
}

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

/**
 * Check if the file is an Excel file (.xlsx, .xls, or .csv)
 */
export function isExcel(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith(".xlsx") || ext.endsWith(".xls") || ext.endsWith(".csv");
}

/**
 * Check if the file is specifically a CSV
 */
export function isCSV(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}

/**
 * Get the file type from filename
 */
export function getFileType(filename: string): "xlsx" | "xls" | "csv" | null {
  const ext = filename.toLowerCase();
  if (ext.endsWith(".xlsx")) return "xlsx";
  if (ext.endsWith(".xls")) return "xls";
  if (ext.endsWith(".csv")) return "csv";
  return null;
}

/**
 * Validate file type and size
 * @param filename - Name of the file
 * @param sizeInBytes - Size of the file in bytes
 * @param maxSizeMB - Maximum allowed size in MB (default: 10)
 */
export function validateFile(
  filename: string,
  sizeInBytes: number,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  const fileType = getFileType(filename);
  
  if (!fileType) {
    return {
      valid: false,
      error: "Invalid file type. Only .xlsx, .xls, and .csv files are allowed.",
    };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (sizeInBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// FILE PARSING
// ============================================================================

/**
 * Process an Excel or CSV file buffer and extract all data
 */
export async function processExcel(buffer: Buffer): Promise<ExcelProcessResult> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        data: [],
        headers: [],
        sheetName: "",
        totalRows: 0,
        success: false,
        error: "No sheets found in the file",
      };
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: null,
      raw: false, // Get formatted strings for consistent processing
    });
    
    // Extract headers from the first row
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    
    return {
      data: jsonData,
      headers,
      sheetName,
      totalRows: jsonData.length,
      success: true,
    };
  } catch (error) {
    console.error("Excel processing error:", error);
    return {
      data: [],
      headers: [],
      sheetName: "",
      totalRows: 0,
      success: false,
      error: error instanceof Error ? error.message : "Failed to process file",
    };
  }
}

/**
 * Parse file and return preview data (first 20 rows)
 * Used for the column mapping UI
 */
export async function parseFileForPreview(
  buffer: Buffer,
  filename: string,
  previewRows: number = 20
): Promise<FilePreviewResult> {
  const fileType = getFileType(filename);
  
  if (!fileType) {
    return {
      headers: [],
      previewData: [],
      totalRows: 0,
      fileName: filename,
      fileType: "xlsx",
      success: false,
      error: "Invalid file type",
    };
  }

  try {
    const result = await processExcel(buffer);
    
    if (!result.success) {
      return {
        headers: [],
        previewData: [],
        totalRows: 0,
        fileName: filename,
        fileType,
        success: false,
        error: result.error,
      };
    }

    return {
      headers: result.headers,
      previewData: result.data.slice(0, previewRows),
      totalRows: result.totalRows,
      fileName: filename,
      fileType,
      success: true,
    };
  } catch (error) {
    console.error("File preview error:", error);
    return {
      headers: [],
      previewData: [],
      totalRows: 0,
      fileName: filename,
      fileType,
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse file",
    };
  }
}

// ============================================================================
// DATA CONVERSION & NORMALIZATION
// ============================================================================

/**
 * Convert Excel data to plain text (for debugging/display)
 */
export function convertExcelToText(result: ExcelProcessResult): string {
  if (!result.success || result.data.length === 0) {
    return "";
  }
  
  const lines: string[] = [];
  
  // Add headers
  lines.push(result.headers.join(" | "));
  lines.push("-".repeat(50));
  
  // Add data rows
  for (const row of result.data) {
    const values = result.headers.map(h => String(row[h] ?? ""));
    lines.push(values.join(" | "));
  }
  
  return lines.join("\n");
}

/**
 * Normalize a product code (SKU)
 * - Trim whitespace
 * - Convert to uppercase
 * - Remove internal spaces
 */
export function normalizeProductCode(code: string | null | undefined): string | null {
  if (!code || typeof code !== "string") return null;
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Normalize a product name
 * - Trim whitespace
 * - Normalize multiple spaces to single space
 */
export function normalizeProductName(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Parse a price value from various formats
 * Handles: "10.00", "10,00", "£10.00", "$10", "10", etc.
 */
export function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  // If already a number, return it
  if (typeof value === "number") {
    return isNaN(value) || !isFinite(value) ? null : value;
  }
  
  // Convert string to number
  let strValue = String(value).trim();
  
  // Remove currency symbols and common prefixes
  strValue = strValue.replace(/[£$€¥₺₹]/g, "");
  
  // Remove thousand separators (but be careful with decimal comma)
  // If there's both comma and period, comma is likely thousand separator
  if (strValue.includes(",") && strValue.includes(".")) {
    // Determine which is the decimal separator based on position
    const commaPos = strValue.lastIndexOf(",");
    const dotPos = strValue.lastIndexOf(".");
    
    if (dotPos > commaPos) {
      // Dot is decimal: 1,234.56 -> 1234.56
      strValue = strValue.replace(/,/g, "");
    } else {
      // Comma is decimal: 1.234,56 -> 1234.56
      strValue = strValue.replace(/\./g, "").replace(",", ".");
    }
  } else if (strValue.includes(",")) {
    // Only comma: could be decimal (European) or thousand separator
    const parts = strValue.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal: 10,50 -> 10.50
      strValue = strValue.replace(",", ".");
    } else {
      // Likely thousand separator: 1,234 -> 1234
      strValue = strValue.replace(/,/g, "");
    }
  }
  
  // Remove any remaining non-numeric characters except . and -
  strValue = strValue.replace(/[^\d.\-]/g, "");
  
  const num = parseFloat(strValue);
  return isNaN(num) || !isFinite(num) ? null : num;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationError {
  row: number;
  field: string;
  value: string | null;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  duplicateCodes: string[];
  validRowCount: number;
  invalidRowCount: number;
}

export interface MappedRow {
  rowIndex: number;
  product_name: string;
  product_code: string | null;
  unit_price: number | null;
  unit: string | null;
  category: string | null;
  originalData: ExcelRow;
}

export interface ColumnMapping {
  product_name: string;      // Required
  product_code?: string;     // Required field but optional in mapping (will use auto-generated if not mapped)
  unit_price: string;        // Required
  unit?: string;             // Optional
  category?: string;         // Optional
}

/**
 * Apply column mapping to raw Excel data
 */
export function applyColumnMapping(
  data: ExcelRow[],
  mapping: ColumnMapping
): MappedRow[] {
  return data.map((row, index) => {
    const productName = normalizeProductName(
      row[mapping.product_name] as string
    );
    
    const productCode = mapping.product_code 
      ? normalizeProductCode(row[mapping.product_code] as string)
      : null;
    
    const unitPrice = parsePrice(row[mapping.unit_price]);
    
    const unit = mapping.unit 
      ? normalizeProductName(row[mapping.unit] as string) || null
      : null;
    
    const category = mapping.category
      ? normalizeProductName(row[mapping.category] as string) || null
      : null;

    return {
      rowIndex: index + 1, // 1-indexed for user display
      product_name: productName,
      product_code: productCode,
      unit_price: unitPrice,
      unit,
      category,
      originalData: row,
    };
  });
}

/**
 * Validate mapped data before import
 */
export function validateMappedData(mappedData: MappedRow[]): ValidationResult {
  const errors: ValidationError[] = [];
  const productCodes: Map<string, number[]> = new Map(); // code -> row numbers
  let validRowCount = 0;
  let invalidRowCount = 0;

  for (const row of mappedData) {
    let rowHasError = false;

    // Validate product_name (required)
    if (!row.product_name || row.product_name.trim() === "") {
      errors.push({
        row: row.rowIndex,
        field: "product_name",
        value: row.product_name || null,
        message: "Product name is required",
      });
      rowHasError = true;
    }

    // Validate unit_price (required and must be positive number)
    if (row.unit_price === null) {
      errors.push({
        row: row.rowIndex,
        field: "unit_price",
        value: String(row.originalData[Object.keys(row.originalData)[0]] || ""),
        message: "Price is required and must be a valid number",
      });
      rowHasError = true;
    } else if (row.unit_price < 0) {
      errors.push({
        row: row.rowIndex,
        field: "unit_price",
        value: String(row.unit_price),
        message: "Price cannot be negative",
      });
      rowHasError = true;
    }

    // Track product codes for duplicate detection
    if (row.product_code) {
      const existing = productCodes.get(row.product_code) || [];
      existing.push(row.rowIndex);
      productCodes.set(row.product_code, existing);
    }

    if (rowHasError) {
      invalidRowCount++;
    } else {
      validRowCount++;
    }
  }

  // Find duplicates
  const duplicateCodes: string[] = [];
  for (const [code, rows] of productCodes.entries()) {
    if (rows.length > 1) {
      duplicateCodes.push(code);
      // Add error for each duplicate occurrence
      for (const rowNum of rows) {
        errors.push({
          row: rowNum,
          field: "product_code",
          value: code,
          message: `Duplicate product code found in rows: ${rows.join(", ")}`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    duplicateCodes,
    validRowCount,
    invalidRowCount,
  };
}
