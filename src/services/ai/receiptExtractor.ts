import { openai, RECEIPT_EXTRACTION_SYSTEM_PROMPT } from "@/lib/openai";
import { ReceiptExtractionResult, ExtractedReceiptItem } from "@/types";
import { ProcessedFile } from "@/services/file";

export async function extractReceiptFromText(text: string): Promise<ReceiptExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Extract all line items from this receipt/invoice:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as ReceiptExtractionResult;
    
    // Validate and clean the result
    const validItems = result.items.filter(
      (item): item is ExtractedReceiptItem =>
        typeof item.productName === "string" &&
        item.productName.length > 0 &&
        typeof item.quantity === "number" &&
        typeof item.unitPrice === "number" &&
        typeof item.totalPrice === "number"
    );

    // Ensure line numbers are sequential
    const itemsWithLineNumbers = validItems.map((item, index) => ({
      ...item,
      lineNumber: item.lineNumber || index + 1,
    }));

    return {
      supplier: result.supplier || null,
      date: result.date || null,
      items: itemsWithLineNumbers,
      totalAmount: result.totalAmount || itemsWithLineNumbers.reduce((sum, item) => sum + item.totalPrice, 0),
      detectedLanguage: result.detectedLanguage || "tr",
    };
  } catch (error) {
    console.error("Receipt extraction error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to extract receipt data"
    );
  }
}

export async function extractReceiptFromImage(
  base64: string,
  mimeType: string
): Promise<ReceiptExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all line items from this receipt/invoice image:",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in response");
    }

    const result = JSON.parse(jsonMatch[0]) as ReceiptExtractionResult;
    
    const validItems = result.items.filter(
      (item): item is ExtractedReceiptItem =>
        typeof item.productName === "string" &&
        item.productName.length > 0 &&
        typeof item.quantity === "number" &&
        typeof item.unitPrice === "number" &&
        typeof item.totalPrice === "number"
    );

    const itemsWithLineNumbers = validItems.map((item, index) => ({
      ...item,
      lineNumber: item.lineNumber || index + 1,
    }));

    return {
      supplier: result.supplier || null,
      date: result.date || null,
      items: itemsWithLineNumbers,
      totalAmount: result.totalAmount || itemsWithLineNumbers.reduce((sum, item) => sum + item.totalPrice, 0),
      detectedLanguage: result.detectedLanguage || "tr",
    };
  } catch (error) {
    console.error("Receipt image extraction error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to extract receipt from image"
    );
  }
}

export async function extractReceipt(
  processedFile: ProcessedFile
): Promise<ReceiptExtractionResult> {
  if (processedFile.type === "image" && processedFile.base64 && processedFile.mimeType) {
    return extractReceiptFromImage(processedFile.base64, processedFile.mimeType);
  }
  
  if (processedFile.text) {
    return extractReceiptFromText(processedFile.text);
  }
  
  throw new Error("No content to extract from");
}
