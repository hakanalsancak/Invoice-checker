import mammoth from "mammoth";

export interface WordProcessResult {
  text: string;
  html: string;
  success: boolean;
  error?: string;
}

export async function processWord(buffer: Buffer): Promise<WordProcessResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const htmlResult = await mammoth.convertToHtml({ buffer });
    
    return {
      text: result.value,
      html: htmlResult.value,
      success: true,
    };
  } catch (error) {
    console.error("Word processing error:", error);
    return {
      text: "",
      html: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to process Word document",
    };
  }
}

export function isWord(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith(".docx") || ext.endsWith(".doc");
}
