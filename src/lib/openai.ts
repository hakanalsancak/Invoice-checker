import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. AI features will not work.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  timeout: 60 * 1000, // 1 minute timeout
  maxRetries: 2,
});

// Product matching prompt for AI-powered price verification
export const PRODUCT_MATCHING_SYSTEM_PROMPT = `You are a product matching expert. Your task is to match a receipt item with the most similar product from a catalogue.

Given:
1. A receipt item (product name from a receipt)
2. A list of catalogue items (potential matches)

Your job is to:
1. Find the best matching catalogue item
2. Consider variations in naming, abbreviations, and formatting
3. Account for Turkish characters and spelling variations
4. Return the match with a confidence score

Return a valid JSON object:
{
  "matchedIndex": 0,  // Index of best match in catalogue array, or -1 if no good match
  "confidence": 0.85, // 0.0 to 1.0
  "reasoning": "Brief explanation of why this match was chosen"
}

Only match if confidence > 0.5. Return matchedIndex: -1 if no good match exists.
Return ONLY valid JSON, no additional text.`;
