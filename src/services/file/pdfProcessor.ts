// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export interface PDFProcessResult {
  text: string;
  pages: number;
  success: boolean;
  error?: string;
}

export async function processPDF(buffer: Buffer): Promise<PDFProcessResult> {
  try {
    const data = await pdfParse(buffer);
    
    return {
      text: data.text,
      pages: data.numpages,
      success: true,
    };
  } catch (error) {
    console.error("PDF processing error:", error);
    return {
      text: "",
      pages: 0,
      success: false,
      error: error instanceof Error ? error.message : "Failed to process PDF",
    };
  }
}

export function isPDF(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}
