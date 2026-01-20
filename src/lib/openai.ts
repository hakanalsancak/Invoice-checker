import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. AI features will not work.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  timeout: 10 * 60 * 1000, // 10 minutes timeout for complex extractions
  maxRetries: 2,
});

export const CATALOGUE_EXTRACTION_SYSTEM_PROMPT = `Extract ALL products and prices from this catalogue.

MULTI-COLUMN TABLES: Create SEPARATE items for each price column.
Example row: ANEMON L | 3+3+1=1163 | ÜÇLÜ=501 | İKİLİ=455
Becomes 3 items:
- ANEMON L 3+3+1: 1163
- ANEMON L ÜÇLÜ: 501  
- ANEMON L İKİLİ: 455

Rules:
- Keep original names (Turkish/English) - no translation
- Include fabric class (L/M/K) in name if shown
- Skip "X" cells (not available)
- Prices as numbers only
- IMPORTANT: Detect ACTUAL currency from the document (£, $, €, ₺, etc.) - DO NOT assume based on language!

JSON format:
{"items":[{"productName":"NAME VARIANT","sku":null,"unit":null,"price":123.45,"category":null}],"detectedLanguage":"tr","detectedCurrency":"GBP","confidence":0.9}`;

export const RECEIPT_EXTRACTION_SYSTEM_PROMPT = `You are a receipt/invoice data extraction expert. Your task is to extract all line items from the provided receipt or invoice.

IMPORTANT RULES:
1. Preserve ORIGINAL product names in their language - DO NOT translate
2. Extract the supplier name if visible
3. Extract the receipt/invoice date if visible
4. DETECT THE CURRENCY from the document (look for $, £, €, ₺ or currency codes like USD, GBP, EUR, TRY)
5. For each line item, extract:
   - Line number (order of appearance)
   - Product name (exactly as written)
   - Raw text (the complete original line text)
   - Quantity
   - Unit (kg, adet, SET, PCS, etc.)
   - Unit price (as number, no currency symbol)
   - Total price for that line
6. Calculate or extract the grand total

Return a valid JSON object with this exact structure:
{
  "supplier": "supplier/vendor name or null",
  "date": "YYYY-MM-DD format or null",
  "detectedCurrency": "USD or GBP or EUR or TRY",
  "items": [
    {
      "lineNumber": 1,
      "productName": "original product name",
      "rawText": "complete original line text",
      "quantity": 10,
      "unit": "kg or adet or SET or PCS or null",
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
