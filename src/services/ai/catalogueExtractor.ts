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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CATALOGUE_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all product prices from this catalogue image:",
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

    // Extract JSON from the response (in case it's wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in response");
    }

    const result = JSON.parse(jsonMatch[0]) as CatalogueExtractionResult;
    
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
