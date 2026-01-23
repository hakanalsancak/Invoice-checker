"use client";

/**
 * Invoice Upload Page
 * 
 * Full-featured upload flow with fuzzy matching:
 * 1. Select catalogues to match against
 * 2. Upload invoice file (Excel/CSV)
 * 3. Map columns to system fields
 * 4. Review match suggestions
 * 5. Confirm and import items
 */

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  Search,
  Check,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import {
  type MatchConfidence,
  scoreToPercentage,
} from "@/services/matching/fuzzyMatcher";

// ============================================================================
// TYPES
// ============================================================================

interface Catalogue {
  id: string;
  name: string;
  currency: string;
  _count: { items: number };
}

interface ExcelRow {
  [key: string]: string | number | null;
}

interface FilePreview {
  fileName: string;
  fileType: string;
  fileSize: number;
  headers: string[];
  previewData: ExcelRow[];
  totalRows: number;
  catalogueItemCount: number;
}

interface ColumnMapping {
  product_name: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  unit: string;
}

interface CatalogueItem {
  id: string;
  productName: string;
  sku: string | null;
  price: number;
  unit: string | null;
  category: string | null;
}

interface MatchSuggestion {
  catalogueItem: CatalogueItem;
  score: number;
  confidence: MatchConfidence;
  matchedOn: string;
}

interface InvoiceItemWithSuggestions {
  invoiceItem: {
    rowIndex: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unit: string | null;
  };
  suggestions: MatchSuggestion[];
  bestMatch: MatchSuggestion | null;
  autoMatched: boolean;
}

interface MatchResult {
  items: InvoiceItemWithSuggestions[];
  stats: {
    totalItems: number;
    autoMatched: number;
    needsReview: number;
    unmatched: number;
  };
  catalogueItems: CatalogueItem[];
}

type Step = "catalogues" | "upload" | "mapping" | "matching" | "importing" | "complete";

// ============================================================================
// CONSTANTS
// ============================================================================

const SYSTEM_FIELDS = [
  { key: "product_name", label: "Product Name", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unit_price", label: "Unit Price", required: true },
  { key: "total_price", label: "Total Price", required: false },
  { key: "unit", label: "Unit", required: false },
] as const;

const ACCEPTED_FILE_TYPES = ".xlsx,.xls,.csv";
const MAX_FILE_SIZE_MB = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchCatalogues(): Promise<Catalogue[]> {
  const response = await fetch("/api/catalogues");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data.filter((c: { status: string }) => c.status === "COMPLETED");
}

function getConfidenceBadgeVariant(
  confidence: MatchConfidence
): "default" | "secondary" | "destructive" | "outline" {
  switch (confidence) {
    case "HIGH": return "default";
    case "MEDIUM": return "secondary";
    case "LOW": return "outline";
    case "NONE": return "destructive";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function InvoiceUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>("catalogues");
  
  // Catalogue selection
  const [selectedCatalogues, setSelectedCatalogues] = useState<string[]>([]);
  
  // Invoice details
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  
  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  
  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    product_name: "",
    quantity: "",
    unit_price: "",
    total_price: "",
    unit: "",
  });
  
  // Matching state
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Map<number, string | null>>(new Map());
  
  // Manual search dialog
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchingForRow, setSearchingForRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    invoiceId: string;
    totalImported: number;
    matchedItems: number;
    unmatchedItems: number;
  } | null>(null);

  // Fetch catalogues
  const { data: catalogues, isLoading: cataloguesLoading } = useQuery({
    queryKey: ["catalogues"],
    queryFn: fetchCatalogues,
  });

  // ==========================================================================
  // CATALOGUE SELECTION
  // ==========================================================================

  const handleCatalogueToggle = (catalogueId: string) => {
    setSelectedCatalogues(prev =>
      prev.includes(catalogueId)
        ? prev.filter(id => id !== catalogueId)
        : [...prev, catalogueId]
    );
  };

  // ==========================================================================
  // FILE HANDLING
  // ==========================================================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleFileSelect = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls") && !ext.endsWith(".csv")) {
      toast.error("Invalid file type. Please upload .xlsx, .xls, or .csv files only.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("catalogueIds", JSON.stringify(selectedCatalogues));

      const response = await fetch("/api/invoices/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to upload file");
      }

      setFilePreview(result.data);
      autoDetectMappings(result.data.headers);
      toast.success("File uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const autoDetectMappings = (headers: string[]) => {
    const newMapping: ColumnMapping = {
      product_name: "",
      quantity: "",
      unit_price: "",
      total_price: "",
      unit: "",
    };

    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Product name
    const namePatterns = ["product", "name", "item", "description", "ürün"];
    for (const pattern of namePatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.product_name = headers[idx];
        break;
      }
    }

    // Quantity
    const qtyPatterns = ["qty", "quantity", "amount", "count", "miktar", "adet"];
    for (const pattern of qtyPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.quantity = headers[idx];
        break;
      }
    }

    // Unit price
    const pricePatterns = ["unit price", "price", "rate", "birim fiyat", "fiyat"];
    for (const pattern of pricePatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.unit_price = headers[idx];
        break;
      }
    }

    // Total
    const totalPatterns = ["total", "amount", "toplam", "tutar"];
    for (const pattern of totalPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern) && !h.includes("unit"));
      if (idx !== -1 && headers[idx] !== newMapping.unit_price) {
        newMapping.total_price = headers[idx];
        break;
      }
    }

    // Unit
    const unitPatterns = ["unit", "uom", "birim"];
    for (const pattern of unitPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern) && !h.includes("price"));
      if (idx !== -1) {
        newMapping.unit = headers[idx];
        break;
      }
    }

    setMapping(newMapping);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setMapping({
      product_name: "",
      quantity: "",
      unit_price: "",
      total_price: "",
      unit: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ==========================================================================
  // MATCHING
  // ==========================================================================

  const performMatching = async () => {
    if (!filePreview) return;

    setIsMatching(true);
    setCurrentStep("matching");

    try {
      const mappingPayload: Record<string, string> = {
        product_name: mapping.product_name,
        quantity: mapping.quantity,
        unit_price: mapping.unit_price,
      };
      if (mapping.total_price) mappingPayload.total_price = mapping.total_price;
      if (mapping.unit) mappingPayload.unit = mapping.unit;

      const response = await fetch("/api/invoices/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filePreview.previewData,
          mapping: mappingPayload,
          catalogueIds: selectedCatalogues,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Matching failed");
      }

      setMatchResult(result.data);

      // Initialize selected matches with best matches
      const initialMatches = new Map<number, string | null>();
      result.data.items.forEach((item: InvoiceItemWithSuggestions) => {
        if (item.autoMatched && item.bestMatch) {
          initialMatches.set(item.invoiceItem.rowIndex, item.bestMatch.catalogueItem.id);
        } else {
          initialMatches.set(item.invoiceItem.rowIndex, null);
        }
      });
      setSelectedMatches(initialMatches);

      toast.success(`Found ${result.data.stats.autoMatched} automatic matches!`);
    } catch (error) {
      console.error("Matching error:", error);
      toast.error(error instanceof Error ? error.message : "Matching failed");
      setCurrentStep("mapping");
    } finally {
      setIsMatching(false);
    }
  };

  const selectMatch = (rowIndex: number, catalogueItemId: string | null) => {
    setSelectedMatches(prev => {
      const newMap = new Map(prev);
      newMap.set(rowIndex, catalogueItemId);
      return newMap;
    });
  };

  const openSearchDialog = (rowIndex: number) => {
    setSearchingForRow(rowIndex);
    setSearchQuery("");
    setSearchDialogOpen(true);
  };

  const selectFromSearch = (catalogueItemId: string) => {
    if (searchingForRow !== null) {
      selectMatch(searchingForRow, catalogueItemId);
    }
    setSearchDialogOpen(false);
    setSearchingForRow(null);
  };

  // ==========================================================================
  // IMPORT
  // ==========================================================================

  const handleImport = async () => {
    if (!matchResult || !supplierName) return;

    setIsImporting(true);
    setCurrentStep("importing");
    setImportProgress(0);

    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const items = matchResult.items.map(item => ({
        productName: item.invoiceItem.productName,
        quantity: item.invoiceItem.quantity,
        unitPrice: item.invoiceItem.unitPrice,
        totalPrice: item.invoiceItem.totalPrice,
        unit: item.invoiceItem.unit,
        catalogueItemId: selectedMatches.get(item.invoiceItem.rowIndex) || null,
      }));

      const response = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName,
          invoiceDate: invoiceDate || undefined,
          currency,
          catalogueIds: selectedCatalogues,
          items,
        }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Import failed");
      }

      setImportResult(result.data);
      setCurrentStep("complete");
      toast.success(`Successfully imported ${result.data.totalImported} items!`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "Import failed");
      setCurrentStep("matching");
    } finally {
      clearInterval(progressInterval);
      setIsImporting(false);
    }
  };

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  const canProceedToUpload = selectedCatalogues.length > 0 && supplierName.trim() !== "";
  const canProceedToMapping = !!filePreview;
  const canProceedToMatching = !!mapping.product_name && !!mapping.quantity && !!mapping.unit_price;

  const getStepProgress = (): number => {
    switch (currentStep) {
      case "catalogues": return 0;
      case "upload": return 20;
      case "mapping": return 40;
      case "matching": return 60;
      case "importing": return 80;
      case "complete": return 100;
      default: return 0;
    }
  };

  // ==========================================================================
  // RENDER: STEP 1 - CATALOGUES
  // ==========================================================================

  const renderCataloguesStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>
            Enter invoice information and select catalogues to match against
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supplier Name */}
          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier Name *</Label>
            <Input
              id="supplierName"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Enter supplier name"
            />
          </div>

          {/* Invoice Date */}
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label>Invoice Currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Catalogue Selection */}
          <div className="space-y-3">
            <Label>Select Catalogue(s) to Match Against *</Label>
            <p className="text-sm text-muted-foreground">
              Invoice items will be matched against products in these catalogues
            </p>

            {cataloguesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading catalogues...
              </div>
            ) : catalogues && catalogues.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {catalogues.map((catalogue) => (
                  <div
                    key={catalogue.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                      selectedCatalogues.includes(catalogue.id) ? "bg-accent" : ""
                    }`}
                    onClick={() => handleCatalogueToggle(catalogue.id)}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 rounded-[4px] border items-center justify-center ${
                        selectedCatalogues.includes(catalogue.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {selectedCatalogues.includes(catalogue.id) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{catalogue.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {catalogue._count.items} items • {catalogue.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border rounded-lg">
                <p className="text-muted-foreground mb-2">No catalogues available</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/catalogues/create">Create a Catalogue First</Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep("upload")}
          disabled={!canProceedToUpload}
          size="lg"
        >
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 2 - UPLOAD
  // ==========================================================================

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Invoice File</CardTitle>
          <CardDescription>
            Upload your invoice Excel or CSV file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFile ? (
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center
                transition-colors cursor-pointer
                ${isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    Drag and drop your invoice file here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">.xlsx</Badge>
                  <Badge variant="outline">.xls</Badge>
                  <Badge variant="outline">.csv</Badge>
                  <span>Max {MAX_FILE_SIZE_MB}MB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                      {filePreview && ` • ${filePreview.totalRows} rows`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {isUploading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing file...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {filePreview && filePreview.previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Preview</CardTitle>
            <CardDescription>
              First {Math.min(filePreview.previewData.length, 5)} rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    {filePreview.headers.map((header, i) => (
                      <TableHead key={i} className="whitespace-nowrap">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filePreview.previewData.slice(0, 5).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {filePreview.headers.map((header, colIdx) => (
                        <TableCell key={colIdx} className="whitespace-nowrap">
                          {String(row[header] ?? "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("catalogues")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep("mapping")}
          disabled={!canProceedToMapping}
          size="lg"
        >
          Continue to Column Mapping
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 3 - MAPPING
  // ==========================================================================

  const renderMappingStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map Columns</CardTitle>
          <CardDescription>
            Match your file columns to invoice fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SYSTEM_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label className="flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={mapping[field.key as keyof ColumnMapping]}
                  onValueChange={(value) =>
                    setMapping(prev => ({ ...prev, [field.key]: value === "_none_" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">
                      <span className="text-muted-foreground">-- Skip --</span>
                    </SelectItem>
                    {filePreview?.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("upload")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={performMatching}
          disabled={!canProceedToMatching || isMatching}
          size="lg"
        >
          {isMatching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding Matches...
            </>
          ) : (
            <>
              Find Matches
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 4 - MATCHING
  // ==========================================================================

  const renderMatchingStep = () => (
    <div className="space-y-6">
      {matchResult && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-500/10">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{matchResult.stats.totalItems}</p>
                    <p className="text-xs text-muted-foreground">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{matchResult.stats.autoMatched}</p>
                    <p className="text-xs text-muted-foreground">Auto-Matched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-500/10">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{matchResult.stats.needsReview}</p>
                    <p className="text-xs text-muted-foreground">Needs Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-500/10">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{matchResult.stats.unmatched}</p>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Review Matches</CardTitle>
              <CardDescription>
                Review and confirm matches. Click on a suggestion to select it, or search manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {matchResult.items.map((item) => {
                    const selectedId = selectedMatches.get(item.invoiceItem.rowIndex);
                    const selectedItem = selectedId
                      ? matchResult.catalogueItems.find(c => c.id === selectedId)
                      : null;

                    return (
                      <div
                        key={item.invoiceItem.rowIndex}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        {/* Invoice Item */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.invoiceItem.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.invoiceItem.quantity}
                              {item.invoiceItem.unit && ` ${item.invoiceItem.unit}`}
                              {" • "}
                              Unit Price: {item.invoiceItem.unitPrice.toFixed(2)}
                              {" • "}
                              Total: {item.invoiceItem.totalPrice.toFixed(2)}
                            </p>
                          </div>
                          {selectedItem ? (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <HelpCircle className="h-3 w-3" />
                              Unmatched
                            </Badge>
                          )}
                        </div>

                        {/* Selected Match */}
                        {selectedItem && (
                          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md p-3">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              → {selectedItem.productName}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500">
                              Catalogue Price: {selectedItem.price.toFixed(2)}
                              {selectedItem.sku && ` • SKU: ${selectedItem.sku}`}
                            </p>
                          </div>
                        )}

                        {/* Suggestions */}
                        {item.suggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Suggestions:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.suggestions.slice(0, 3).map((suggestion) => (
                                <Button
                                  key={suggestion.catalogueItem.id}
                                  variant={
                                    selectedId === suggestion.catalogueItem.id
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="h-auto py-1 px-2"
                                  onClick={() =>
                                    selectMatch(
                                      item.invoiceItem.rowIndex,
                                      suggestion.catalogueItem.id
                                    )
                                  }
                                >
                                  <span className="truncate max-w-[150px]">
                                    {suggestion.catalogueItem.productName}
                                  </span>
                                  <Badge
                                    variant={getConfidenceBadgeVariant(suggestion.confidence)}
                                    className="ml-2 text-xs"
                                  >
                                    {scoreToPercentage(suggestion.score)}%
                                  </Badge>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSearchDialog(item.invoiceItem.rowIndex)}
                          >
                            <Search className="mr-1 h-3 w-3" />
                            Search
                          </Button>
                          {selectedId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => selectMatch(item.invoiceItem.rowIndex, null)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Search Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Search Catalogue</DialogTitle>
            <DialogDescription>
              Find and select a matching product from the catalogue
            </DialogDescription>
          </DialogHeader>
          <Command className="rounded-lg border">
            <CommandInput
              placeholder="Search products..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup>
                {matchResult?.catalogueItems
                  .filter(item =>
                    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .slice(0, 20)
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => selectFromSearch(item.id)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          Price: {item.price.toFixed(2)}
                          {item.sku && ` • SKU: ${item.sku}`}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("mapping")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleImport} disabled={isImporting} size="lg">
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import Invoice
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 5 - IMPORTING
  // ==========================================================================

  const renderImportingStep = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Importing Invoice Items</h3>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
            <div className="w-full max-w-md">
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-2">
                {importProgress}% complete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 6 - COMPLETE
  // ==========================================================================

  const renderCompleteStep = () => (
    <div className="space-y-6">
      {importResult && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="p-4 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold">Import Complete!</h3>
                  <p className="text-muted-foreground mt-1">
                    Invoice for &quot;{supplierName}&quot; has been created
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{importResult.totalImported}</p>
                <p className="text-sm text-muted-foreground">Items Imported</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.matchedItems}</p>
                <p className="text-sm text-muted-foreground">Matched</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-yellow-600">{importResult.unmatchedItems}</p>
                <p className="text-sm text-muted-foreground">Unmatched</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push("/invoices")}>
              View All Invoices
            </Button>
            <Button onClick={() => router.push(`/invoices/${importResult.invoiceId}`)}>
              View Invoice
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/invoices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Invoice</h1>
        <p className="text-muted-foreground">
          Upload an invoice file and match items to your catalogues
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className={currentStep === "catalogues" ? "text-primary font-medium" : "text-muted-foreground"}>
            1. Details
          </span>
          <span className={currentStep === "upload" ? "text-primary font-medium" : "text-muted-foreground"}>
            2. Upload
          </span>
          <span className={currentStep === "mapping" ? "text-primary font-medium" : "text-muted-foreground"}>
            3. Map
          </span>
          <span className={currentStep === "matching" ? "text-primary font-medium" : "text-muted-foreground"}>
            4. Match
          </span>
          <span className={currentStep === "complete" || currentStep === "importing" ? "text-primary font-medium" : "text-muted-foreground"}>
            5. Done
          </span>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
      </div>

      {/* Step content */}
      {currentStep === "catalogues" && renderCataloguesStep()}
      {currentStep === "upload" && renderUploadStep()}
      {currentStep === "mapping" && renderMappingStep()}
      {currentStep === "matching" && renderMatchingStep()}
      {currentStep === "importing" && renderImportingStep()}
      {currentStep === "complete" && renderCompleteStep()}
    </div>
  );
}
