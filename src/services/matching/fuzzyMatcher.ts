/**
 * Fuzzy Matching Service
 * 
 * Uses Fuse.js to find best matches between invoice items and catalogue items.
 * Provides confidence scores and suggestions for user review.
 */

import Fuse from 'fuse.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CatalogueItemForMatching {
  id: string;
  productName: string;
  sku: string | null;
  price: number;
  unit: string | null;
  category: string | null;
}

export interface InvoiceItemForMatching {
  rowIndex: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string | null;
}

export interface MatchSuggestion {
  catalogueItem: CatalogueItemForMatching;
  score: number; // 0 = perfect match, 1 = no match
  confidence: MatchConfidence;
  matchedOn: 'productName' | 'sku' | 'both';
}

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface InvoiceItemWithSuggestions {
  invoiceItem: InvoiceItemForMatching;
  suggestions: MatchSuggestion[];
  bestMatch: MatchSuggestion | null;
  autoMatched: boolean; // True if confidence is HIGH
}

// ============================================================================
// FUZZY MATCHER CLASS
// ============================================================================

export class FuzzyMatcher {
  private fuse: Fuse<CatalogueItemForMatching>;
  private catalogueItems: CatalogueItemForMatching[];

  constructor(catalogueItems: CatalogueItemForMatching[]) {
    this.catalogueItems = catalogueItems;
    
    // Configure Fuse.js for optimal matching
    this.fuse = new Fuse(catalogueItems, {
      keys: [
        { name: 'productName', weight: 0.7 },
        { name: 'sku', weight: 0.3 },
      ],
      threshold: 0.5, // 0 = exact match required, 1 = match anything
      includeScore: true,
      ignoreLocation: true, // Don't care where in the string the match is
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      useExtendedSearch: false,
    });
  }

  /**
   * Find best matches for a single invoice item
   */
  findMatches(
    productName: string,
    maxResults: number = 5
  ): MatchSuggestion[] {
    if (!productName || productName.trim() === '') {
      return [];
    }

    // Normalize the search term
    const normalizedName = this.normalizeText(productName);
    
    // Search using Fuse.js
    const results = this.fuse.search(normalizedName, { limit: maxResults });

    return results.map(result => ({
      catalogueItem: result.item,
      score: result.score || 1,
      confidence: this.getConfidence(result.score || 1),
      matchedOn: this.determineMatchType(normalizedName, result.item),
    }));
  }

  /**
   * Find matches for multiple invoice items
   */
  findMatchesForItems(
    invoiceItems: InvoiceItemForMatching[],
    maxSuggestionsPerItem: number = 5
  ): InvoiceItemWithSuggestions[] {
    return invoiceItems.map(item => {
      const suggestions = this.findMatches(item.productName, maxSuggestionsPerItem);
      const bestMatch = suggestions.length > 0 ? suggestions[0] : null;
      
      return {
        invoiceItem: item,
        suggestions,
        bestMatch,
        autoMatched: bestMatch?.confidence === 'HIGH',
      };
    });
  }

  /**
   * Get all catalogue items (for manual search)
   */
  getAllItems(): CatalogueItemForMatching[] {
    return this.catalogueItems;
  }

  /**
   * Search catalogue items by query (for manual search UI)
   */
  searchItems(query: string, limit: number = 20): CatalogueItemForMatching[] {
    if (!query || query.trim() === '') {
      return this.catalogueItems.slice(0, limit);
    }
    
    const results = this.fuse.search(query, { limit });
    return results.map(r => r.item);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ''); // Remove special characters
  }

  private getConfidence(score: number): MatchConfidence {
    // Fuse.js score: 0 = perfect match, 1 = no match
    if (score <= 0.1) return 'HIGH';      // 90%+ match
    if (score <= 0.25) return 'MEDIUM';   // 75%+ match
    if (score <= 0.4) return 'LOW';       // 60%+ match
    return 'NONE';                         // Below 60%
  }

  private determineMatchType(
    searchTerm: string,
    item: CatalogueItemForMatching
  ): 'productName' | 'sku' | 'both' {
    const normalizedSearch = this.normalizeText(searchTerm);
    const normalizedName = this.normalizeText(item.productName);
    const normalizedSku = item.sku ? this.normalizeText(item.sku) : '';

    const nameMatch = normalizedName.includes(normalizedSearch) || 
                      normalizedSearch.includes(normalizedName);
    const skuMatch = normalizedSku && (
      normalizedSku.includes(normalizedSearch) || 
      normalizedSearch.includes(normalizedSku)
    );

    if (nameMatch && skuMatch) return 'both';
    if (skuMatch) return 'sku';
    return 'productName';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate match percentage for display (inverse of Fuse score)
 */
export function scoreToPercentage(score: number): number {
  return Math.round((1 - score) * 100);
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence: MatchConfidence): string {
  switch (confidence) {
    case 'HIGH': return 'text-green-600';
    case 'MEDIUM': return 'text-yellow-600';
    case 'LOW': return 'text-orange-600';
    case 'NONE': return 'text-red-600';
  }
}

/**
 * Get confidence badge variant
 */
export function getConfidenceBadgeVariant(
  confidence: MatchConfidence
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (confidence) {
    case 'HIGH': return 'default';
    case 'MEDIUM': return 'secondary';
    case 'LOW': return 'outline';
    case 'NONE': return 'destructive';
  }
}
