import { processPDF, isPDF } from "./pdfProcessor";
import { processExcel, convertExcelToText, isExcel, isCSV } from "./excelProcessor";
import { processWord, isWord } from "./wordProcessor";
import { processImage, isImage } from "./imageProcessor";

export type FileType = "pdf" | "excel" | "csv" | "word" | "image" | "unknown";

export interface ProcessedFile {
  type: FileType;
  text: string;
  base64?: string;
  mimeType?: string;
  success: boolean;
  error?: string;
}

export function detectFileType(filename: string): FileType {
  if (isPDF(filename)) return "pdf";
  if (isCSV(filename)) return "csv";
  if (isExcel(filename)) return "excel";
  if (isWord(filename)) return "word";
  if (isImage(filename)) return "image";
  return "unknown";
}

export async function processFile(buffer: Buffer, filename: string): Promise<ProcessedFile> {
  const fileType = detectFileType(filename);
  
  switch (fileType) {
    case "pdf": {
      const result = await processPDF(buffer);
      return {
        type: "pdf",
        text: result.text,
        success: result.success,
        error: result.error,
      };
    }
    
    case "excel":
    case "csv": {
      const result = await processExcel(buffer);
      const text = convertExcelToText(result);
      return {
        type: fileType,
        text,
        success: result.success,
        error: result.error,
      };
    }
    
    case "word": {
      const result = await processWord(buffer);
      return {
        type: "word",
        text: result.text,
        success: result.success,
        error: result.error,
      };
    }
    
    case "image": {
      const result = await processImage(buffer, filename);
      return {
        type: "image",
        text: "", // Images don't have text - AI will process them directly
        base64: result.base64,
        mimeType: result.mimeType,
        success: result.success,
        error: result.error,
      };
    }
    
    default:
      return {
        type: "unknown",
        text: "",
        success: false,
        error: "Unsupported file type",
      };
  }
}

export function getSupportedExtensions(): string[] {
  return [
    ".pdf",
    ".xlsx", ".xls", ".csv",
    ".docx", ".doc",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ];
}

export function isFileSupported(filename: string): boolean {
  return detectFileType(filename) !== "unknown";
}
