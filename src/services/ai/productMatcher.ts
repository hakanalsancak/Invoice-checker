import { openai, PRODUCT_MATCHING_SYSTEM_PROMPT } from "@/lib/openai";
import { ProductMatchResult, MatchConfidence } from "@/types";

interface CatalogueItem {
  id: string;
  productName: string;
  sku: string | null;
}

interface MatchResult {
  catalogueItemId: string | null;
  confidence: MatchConfidence;
  confidenceScore: number;
  reasoning: string;
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Check for exact match
function checkExactMatch(
  receiptProductName: string,
  catalogueItems: CatalogueItem[]
): MatchResult | null {
  const normalizedReceipt = normalizeText(receiptProductName);
  
  for (const item of catalogueItems) {
    // Check exact name match
    if (normalizeText(item.productName) === normalizedReceipt) {
      return {
        catalogueItemId: item.id,
        confidence: "EXACT",
        confidenceScore: 1.0,
        reasoning: "Exact product name match",
      };
    }
    
    // Check SKU match if available
    if (item.sku && normalizeText(item.sku) === normalizedReceipt) {
      return {
        catalogueItemId: item.id,
        confidence: "EXACT",
        confidenceScore: 1.0,
        reasoning: "Exact SKU match",
      };
    }
  }
  
  return null;
}

// Check for normalized/fuzzy match
function checkNormalizedMatch(
  receiptProductName: string,
  catalogueItems: CatalogueItem[]
): MatchResult | null {
  const normalizedReceipt = normalizeText(receiptProductName);
  const receiptWords = normalizedReceipt.split(" ").filter(w => w.length > 2);
  
  let bestMatch: { item: CatalogueItem; score: number } | null = null;
  
  for (const item of catalogueItems) {
    const normalizedCatalogue = normalizeText(item.productName);
    const catalogueWords = normalizedCatalogue.split(" ").filter(w => w.length > 2);
    
    // Check if one contains the other
    if (normalizedCatalogue.includes(normalizedReceipt) || 
        normalizedReceipt.includes(normalizedCatalogue)) {
      const score = 0.9;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item, score };
      }
      continue;
    }
    
    // Calculate word overlap
    const matchedWords = receiptWords.filter(w => catalogueWords.includes(w));
    const matchRatio = matchedWords.length / Math.max(receiptWords.length, catalogueWords.length);
    
    if (matchRatio >= 0.7) {
      if (!bestMatch || matchRatio > bestMatch.score) {
        bestMatch = { item, score: matchRatio };
      }
    }
  }
  
  if (bestMatch && bestMatch.score >= 0.7) {
    return {
      catalogueItemId: bestMatch.item.id,
      confidence: bestMatch.score >= 0.9 ? "HIGH" : "MEDIUM",
      confidenceScore: bestMatch.score,
      reasoning: `Normalized text match with ${Math.round(bestMatch.score * 100)}% similarity`,
    };
  }
  
  return null;
}

// Use AI for fuzzy matching
async function checkAIMatch(
  receiptProductName: string,
  catalogueItems: CatalogueItem[]
): Promise<MatchResult> {
  if (catalogueItems.length === 0) {
    return {
      catalogueItemId: null,
      confidence: "UNMATCHED",
      confidenceScore: 0,
      reasoning: "No catalogue items to match against",
    };
  }

  try {
    // Limit to top 20 candidates to save tokens
    const candidates = catalogueItems.slice(0, 20);
    
    const catalogueList = candidates
      .map((item, index) => `${index}. ${item.productName}${item.sku ? ` (SKU: ${item.sku})` : ""}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: PRODUCT_MATCHING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Receipt item: "${receiptProductName}"\n\nCatalogue items:\n${catalogueList}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as ProductMatchResult;
    
    if (result.matchedIndex >= 0 && result.matchedIndex < candidates.length) {
      let confidence: MatchConfidence;
      if (result.confidence >= 0.9) confidence = "HIGH";
      else if (result.confidence >= 0.7) confidence = "MEDIUM";
      else if (result.confidence >= 0.5) confidence = "LOW";
      else confidence = "UNMATCHED";

      return {
        catalogueItemId: result.confidence >= 0.5 ? candidates[result.matchedIndex].id : null,
        confidence,
        confidenceScore: result.confidence,
        reasoning: result.reasoning || "AI-powered match",
      };
    }

    return {
      catalogueItemId: null,
      confidence: "UNMATCHED",
      confidenceScore: 0,
      reasoning: result.reasoning || "No suitable match found",
    };
  } catch (error) {
    console.error("AI matching error:", error);
    return {
      catalogueItemId: null,
      confidence: "UNMATCHED",
      confidenceScore: 0,
      reasoning: "AI matching failed",
    };
  }
}

// Main matching function with multi-layer approach
export async function matchProduct(
  receiptProductName: string,
  catalogueItems: CatalogueItem[]
): Promise<MatchResult> {
  // Layer 1: Exact match
  const exactMatch = checkExactMatch(receiptProductName, catalogueItems);
  if (exactMatch) {
    return exactMatch;
  }

  // Layer 2: Normalized match
  const normalizedMatch = checkNormalizedMatch(receiptProductName, catalogueItems);
  if (normalizedMatch) {
    return normalizedMatch;
  }

  // Layer 3: AI fuzzy match
  return checkAIMatch(receiptProductName, catalogueItems);
}

// Batch matching for multiple items
export async function matchProducts(
  receiptItems: { id: string; productName: string }[],
  catalogueItems: CatalogueItem[]
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  
  // Process items that need AI matching in batches
  const itemsNeedingAI: { id: string; productName: string }[] = [];
  
  for (const item of receiptItems) {
    // Try exact and normalized matching first
    const exactMatch = checkExactMatch(item.productName, catalogueItems);
    if (exactMatch) {
      results.set(item.id, exactMatch);
      continue;
    }
    
    const normalizedMatch = checkNormalizedMatch(item.productName, catalogueItems);
    if (normalizedMatch) {
      results.set(item.id, normalizedMatch);
      continue;
    }
    
    itemsNeedingAI.push(item);
  }
  
  // Process AI matching (could be parallelized but being mindful of rate limits)
  for (const item of itemsNeedingAI) {
    const aiMatch = await checkAIMatch(item.productName, catalogueItems);
    results.set(item.id, aiMatch);
  }
  
  return results;
}
