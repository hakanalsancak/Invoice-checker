import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. AI features will not work.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const CATALOGUE_EXTRACTION_SYSTEM_PROMPT = `You are a price catalogue data extraction expert. Your task is to extract all products with their prices from the provided document.

IMPORTANT RULES:
1. Maintain the ORIGINAL language of product names (Turkish, English, etc.) - DO NOT translate them
2. Extract ALL products visible in the document
3. If a product code/SKU is visible, include it
4. Detect the unit of measurement (kg, adet, kutu, paket, lt, etc.)
5. Prices should be numbers without currency symbols
6. Infer categories when possible based on product names

Return a valid JSON object with this exact structure:
{
  "items": [
    {
      "productName": "original product name in document language",
      "sku": "product code if available, null otherwise",
      "unit": "unit of measurement (kg/adet/kutu/etc), null if unknown",
      "price": 123.45,
      "category": "inferred category or null"
    }
  ],
  "detectedLanguage": "tr or en or other ISO code",
  "confidence": 0.95
}

Return ONLY valid JSON, no additional text.`;

export const RECEIPT_EXTRACTION_SYSTEM_PROMPT = `You are a receipt/invoice data extraction expert. Your task is to extract all line items from the provided receipt or invoice.

IMPORTANT RULES:
1. Preserve ORIGINAL product names in their language - DO NOT translate
2. Extract the supplier name if visible
3. Extract the receipt/invoice date if visible
4. For each line item, extract:
   - Line number (order of appearance)
   - Product name (exactly as written)
   - Raw text (the complete original line text)
   - Quantity
   - Unit (kg, adet, etc.)
   - Unit price
   - Total price for that line
5. Calculate or extract the grand total

Return a valid JSON object with this exact structure:
{
  "supplier": "supplier/vendor name or null",
  "date": "YYYY-MM-DD format or null",
  "items": [
    {
      "lineNumber": 1,
      "productName": "original product name",
      "rawText": "complete original line text",
      "quantity": 10,
      "unit": "kg or adet or null",
      "unitPrice": 45.50,
      "totalPrice": 455.00
    }
  ],
  "totalAmount": 1234.56,
  "detectedLanguage": "tr or en or other ISO code"
}

Return ONLY valid JSON, no additional text.`;

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
