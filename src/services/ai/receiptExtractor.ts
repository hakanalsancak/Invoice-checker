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
      detectedCurrency: result.detectedCurrency || "USD",
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
    console.log("Starting receipt image extraction with GPT-4o...");
    
    // Detailed user prompt for maximum accuracy
    const userPrompt = `IMPORTANT: This invoice extraction requires 100% ACCURACY. Read CAREFULLY.

STEP 1: Count the TOTAL number of product rows in the table (rows with Quantity, Product Name, Price).
STEP 2: Extract EACH row one by one - do NOT skip any.
STEP 3: For each row, read the EXACT values:
   - Quantity: the number in the first column
   - Unit: SET, PCS, etc.
   - Product Name: copy EXACTLY as written
   - Unit Price: read the EXACT number from "Unit price ($)" column
   - Total: read the EXACT number from "Total ($)" column

ACCURACY CHECK:
- Your item count MUST match the number of product rows
- Prices must be copied EXACTLY as shown (e.g., 1,067.00 → 1067.00)
- Do NOT calculate - just read what's printed

Look for:
- Currency symbols in headers ($ means USD)
- Company name at top
- Invoice date
- Sub Total at bottom

Return complete JSON with ALL items. If there are 56 product rows, return 56 items.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high", // Maximum detail for accurate reading
              },
            },
          ],
        },
      ],
      temperature: 0, // Zero temperature for maximum consistency/accuracy
      max_tokens: 16000,
    });

    const content = response.choices[0]?.message?.content;
    console.log("OpenAI response received, length:", content?.length);
    
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Try to extract JSON from the response
    let jsonContent = content;
    
    // If wrapped in markdown code blocks, extract the JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    } else {
      // Try to find raw JSON object
      const rawJsonMatch = content.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonContent = rawJsonMatch[0];
      }
    }

    // Try to parse JSON, with recovery for truncated responses
    let result: ReceiptExtractionResult;
    try {
      result = JSON.parse(jsonContent) as ReceiptExtractionResult;
    } catch (parseError) {
      console.log("JSON parse failed, attempting recovery...");
      
      // Try to fix truncated JSON by closing arrays/objects
      let fixedJson = jsonContent;
      
      // Count open brackets and close them
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      
      // Remove any trailing incomplete item
      fixedJson = fixedJson.replace(/,\s*\{[^}]*$/, '');
      fixedJson = fixedJson.replace(/,\s*"[^"]*$/, '');
      
      // Close arrays and objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixedJson += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }
      
      try {
        result = JSON.parse(fixedJson) as ReceiptExtractionResult;
        console.log("JSON recovery successful!");
      } catch (secondError) {
        console.error("JSON recovery failed:", secondError);
        // Return empty result instead of throwing
        return {
          supplier: null,
          date: null,
          items: [],
          totalAmount: 0,
          detectedLanguage: "en",
          detectedCurrency: "USD",
        };
      }
    }

    // Ensure items array exists
    if (!result.items || !Array.isArray(result.items)) {
      result.items = [];
    }
    
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

    console.log(`Extracted ${itemsWithLineNumbers.length} valid receipt items, currency: ${result.detectedCurrency || "USD"}`);

    return {
      supplier: result.supplier || null,
      date: result.date || null,
      items: itemsWithLineNumbers,
      totalAmount: result.totalAmount || itemsWithLineNumbers.reduce((sum, item) => sum + item.totalPrice, 0),
      detectedLanguage: result.detectedLanguage || "en",
      detectedCurrency: result.detectedCurrency || "USD",
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
