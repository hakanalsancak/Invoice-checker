import * as XLSX from "xlsx";

export interface ExcelRow {
  [key: string]: string | number | null;
}

export interface ExcelProcessResult {
  data: ExcelRow[];
  headers: string[];
  sheetName: string;
  success: boolean;
  error?: string;
}

export async function processExcel(buffer: Buffer): Promise<ExcelProcessResult> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: null,
      raw: false,
    });
    
    // Extract headers
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    
    return {
      data: jsonData,
      headers,
      sheetName,
      success: true,
    };
  } catch (error) {
    console.error("Excel processing error:", error);
    return {
      data: [],
      headers: [],
      sheetName: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to process Excel file",
    };
  }
}

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

export function isExcel(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith(".xlsx") || ext.endsWith(".xls") || ext.endsWith(".csv");
}

export function isCSV(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}
