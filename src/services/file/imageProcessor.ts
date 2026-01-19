export interface ImageProcessResult {
  base64: string;
  mimeType: string;
  success: boolean;
  error?: string;
}

export async function processImage(buffer: Buffer, filename: string): Promise<ImageProcessResult> {
  try {
    const mimeType = getMimeType(filename);
    const base64 = buffer.toString("base64");
    
    return {
      base64,
      mimeType,
      success: true,
    };
  } catch (error) {
    console.error("Image processing error:", error);
    return {
      base64: "",
      mimeType: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
}

export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

export function isImage(filename: string): boolean {
  const ext = filename.toLowerCase();
  return (
    ext.endsWith(".jpg") ||
    ext.endsWith(".jpeg") ||
    ext.endsWith(".png") ||
    ext.endsWith(".gif") ||
    ext.endsWith(".webp")
  );
}
