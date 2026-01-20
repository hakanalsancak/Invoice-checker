import { openai, CATALOGUE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/openai";
import { CatalogueExtractionResult, ExtractedCatalogueItem } from "@/types";
import { ProcessedFile } from "@/services/file";

export async function extractCatalogueFromText(text: string): Promise<CatalogueExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: CATALOGUE_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Extract all product prices from this catalogue:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 16000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as CatalogueExtractionResult;
    
    // Validate and clean the result
    const validItems = result.items.filter(
      (item): item is ExtractedCatalogueItem =>
        typeof item.productName === "string" &&
        item.productName.length > 0 &&
        typeof item.price === "number" &&
        item.price > 0
    );

    return {
      items: validItems,
      detectedLanguage: result.detectedLanguage || "tr",
      detectedCurrency: result.detectedCurrency || "GBP",
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("Catalogue extraction error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to extract catalogue data"
    );
  }
}

export async function extractCatalogueFromImage(
  base64: string,
  mimeType: string
): Promise<CatalogueExtractionResult> {
  try {
    console.log("Starting image extraction with GPT-4o...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CATALOGUE_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all prices. Multi-column table: create separate item per price column (e.g., 'ANEMON L 3+3+1': 1163, 'ANEMON L ÜÇLÜ': 501). Skip X cells. Return JSON only.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 16000, // Increased for large catalogues
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
    let result: CatalogueExtractionResult;
    try {
      result = JSON.parse(jsonContent) as CatalogueExtractionResult;
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
        result = JSON.parse(fixedJson) as CatalogueExtractionResult;
        console.log("JSON recovery successful!");
      } catch (secondError) {
        console.error("JSON recovery failed:", secondError);
        // Return empty result instead of throwing
        return {
          items: [],
          detectedLanguage: "tr",
          detectedCurrency: "GBP",
          confidence: 0,
        };
      }
    }
    
    // Ensure items array exists
    if (!result.items || !Array.isArray(result.items)) {
      result.items = [];
    }
    
    const validItems = result.items.filter(
      (item): item is ExtractedCatalogueItem =>
        typeof item.productName === "string" &&
        item.productName.length > 0 &&
        typeof item.price === "number" &&
        item.price > 0
    );

    console.log(`Extracted ${validItems.length} valid items, currency: ${result.detectedCurrency || "GBP"}`);

    return {
      items: validItems,
      detectedLanguage: result.detectedLanguage || "tr",
      detectedCurrency: result.detectedCurrency || "GBP",
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("Catalogue image extraction error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to extract catalogue from image"
    );
  }
}

export async function extractCatalogue(
  processedFile: ProcessedFile
): Promise<CatalogueExtractionResult> {
  if (processedFile.type === "image" && processedFile.base64 && processedFile.mimeType) {
    return extractCatalogueFromImage(processedFile.base64, processedFile.mimeType);
  }
  
  if (processedFile.text) {
    return extractCatalogueFromText(processedFile.text);
  }
  
  throw new Error("No content to extract from");
}
