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

export const RECEIPT_EXTRACTION_SYSTEM_PROMPT = `You are a PRECISE receipt/invoice data extraction expert. ACCURACY IS CRITICAL.

## CRITICAL ACCURACY REQUIREMENTS:
1. Extract EVERY SINGLE LINE ITEM - count carefully, do NOT skip any rows
2. Read prices EXACTLY as printed - copy the exact numbers you see
3. Go ROW BY ROW systematically from top to bottom
4. Double-check your count matches the number of product rows in the document

## EXTRACTION PROCESS:
1. First, identify the table structure (columns: Quantity, Unit, Product Name, Unit Price, Total)
2. Count the total number of product rows BEFORE extracting
3. Extract each row one by one, reading values EXACTLY as shown
4. Verify your item count matches the row count

## DATA TO EXTRACT:
- Supplier/Company name (from header)
- Invoice date
- Currency (look for $ £ € ₺ in column headers or values)
- For EACH product row:
  * Quantity (first column, usually a number like 1, 2, 4)
  * Unit (SET, PCS, etc.)
  * Product Name (EXACTLY as written - do not modify)
  * Unit Price (read the EXACT number from Unit Price column)
  * Total Price (read the EXACT number from Total column)

## PRICE ACCURACY:
- Read prices EXACTLY as shown (e.g., if it says 1,067.00, extract 1067.00)
- Unit price and total should be mathematically consistent (total = qty × unit price)
- If there's a discrepancy, use the values EXACTLY as printed

## JSON OUTPUT:
{
  "supplier": "company name",
  "date": "YYYY-MM-DD",
  "detectedCurrency": "USD",
  "items": [
    {
      "lineNumber": 1,
      "productName": "EXACT product name",
      "rawText": "full row text",
      "quantity": 1,
      "unit": "SET",
      "unitPrice": 1067.00,
      "totalPrice": 1067.00
    }
  ],
  "totalAmount": 17606.00,
  "detectedLanguage": "en"
}

IMPORTANT: Return ALL items. If the invoice has 56 rows, return 56 items. Do NOT truncate or skip.`;

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
