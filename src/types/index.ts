// Processing status enum (matches Prisma)
export type ProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

// Match confidence enum (matches Prisma)
export type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "UNMATCHED";

// Comparison status enum (matches Prisma)
export type ComparisonStatus = "MATCH" | "OVERCHARGE" | "UNDERCHARGE" | "UNMATCHED";

// Prisma Decimal type placeholder (converts to number in runtime)
type PrismaDecimal = number | string | { toNumber(): number };

// Extracted catalogue item from AI
export interface ExtractedCatalogueItem {
  productName: string;
  sku: string | null;
  unit: string | null;
  price: number;
  category: string | null;
}

// AI extraction result for catalogue
export interface CatalogueExtractionResult {
  items: ExtractedCatalogueItem[];
  detectedLanguage: string;
  detectedCurrency?: string; // ISO currency code (GBP, USD, EUR, TRY, etc.)
  confidence: number;
}

// Extracted receipt item from AI
export interface ExtractedReceiptItem {
  lineNumber: number;
  productName: string;
  rawText: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
}

// AI extraction result for receipt
export interface ReceiptExtractionResult {
  supplier: string | null;
  date: string | null;
  items: ExtractedReceiptItem[];
  totalAmount: number;
  detectedLanguage: string;
  detectedCurrency?: string; // ISO currency code (USD, GBP, EUR, TRY, etc.)
}

// Product matching result from AI
export interface ProductMatchResult {
  matchedIndex: number;
  confidence: number;
  reasoning: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Catalogue with items for display
export interface CatalogueWithItems {
  id: string;
  userId: string;
  name: string;
  originalFileName: string;
  fileUrl: string | null;
  language: string;
  currency: string; // ISO currency code (GBP, USD, EUR, TRY, etc.)
  status: ProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
  items: CatalogueItemDisplay[];
  _count?: {
    items: number;
  };
}

// Catalogue item for display
export interface CatalogueItemDisplay {
  id: string;
  catalogueId: string;
  productName: string;
  sku: string | null;
  unit: string | null;
  price: number | PrismaDecimal;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Receipt with items for display
export interface ReceiptWithItems {
  id: string;
  userId: string;
  supplierName: string | null;
  originalFileName: string;
  fileUrl: string | null;
  receiptDate: Date | null;
  totalAmount: number | PrismaDecimal | null;
  language: string;
  currency: string; // ISO currency code
  status: ProcessingStatus;
  createdAt: Date;
  items: ReceiptItemDisplay[];
  _count?: {
    items: number;
  };
}

// Receipt item for display
export interface ReceiptItemDisplay {
  id: string;
  receiptId: string;
  productName: string;
  rawText: string | null;
  quantity: number | PrismaDecimal;
  unit: string | null;
  unitPrice: number | PrismaDecimal;
  totalPrice: number | PrismaDecimal;
  lineNumber: number;
}

// Comparison report with details
export interface ComparisonReportWithDetails {
  id: string;
  receiptId: string;
  catalogueId: string;
  totalItems: number;
  matchedItems: number;
  mismatches: number;
  totalOvercharge: number | PrismaDecimal;
  totalUndercharge: number | PrismaDecimal;
  receiptCurrency: string; // Currency of the receipt
  catalogueCurrency: string; // Currency of the catalogue
  exchangeRate: number | PrismaDecimal | null; // Exchange rate used
  createdAt: Date;
  receipt: {
    id: string;
    supplierName: string | null;
    originalFileName: string;
    receiptDate: Date | null;
    currency: string;
  };
  catalogue: {
    id: string;
    name: string;
    currency: string;
  };
  items: ComparisonItemDisplay[];
}

// Comparison item for display
export interface ComparisonItemDisplay {
  id: string;
  receiptPrice: number | PrismaDecimal; // Original price in receipt currency
  receiptPriceConverted: number | PrismaDecimal | null; // Converted to catalogue currency
  cataloguePrice: number | PrismaDecimal | null; // Price in catalogue currency
  priceDifference: number | PrismaDecimal | null; // Difference after conversion
  percentageDiff: number | PrismaDecimal | null;
  exchangeRate: number | PrismaDecimal | null; // Exchange rate used
  matchConfidence: MatchConfidence;
  status: ComparisonStatus;
  receiptItem: {
    productName: string;
    quantity: number | PrismaDecimal;
    unit: string | null;
  };
  catalogueItem: {
    productName: string;
    sku: string | null;
    unit: string | null;
  } | null;
}

// Dashboard statistics
export interface DashboardStats {
  totalCatalogues: number;
  totalReceipts: number;
  totalReports: number;
  totalSavingsDetected: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: "catalogue" | "receipt" | "report";
  title: string;
  description: string;
  createdAt: Date;
}
