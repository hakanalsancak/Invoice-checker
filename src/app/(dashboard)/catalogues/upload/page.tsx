"use client";

/**
 * Catalogue Upload Page
 * 
 * Full-featured upload flow:
 * 1. File Upload - Drag & drop or click to select
 * 2. Column Mapping - Map Excel columns to system fields
 * 3. Validation - Review errors and warnings
 * 4. Import - Save products to database
 */

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  File,
  X,
  Info,
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

// ============================================================================
// TYPES
// ============================================================================

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
}

interface ColumnMapping {
  product_name: string;
  product_code: string;
  unit_price: string;
  unit: string;
  category: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: string | null;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  totalErrors: number;
  duplicateCodes: string[];
  validRowCount: number;
  invalidRowCount: number;
  previewData: MappedPreviewRow[];
}

interface MappedPreviewRow {
  rowIndex: number;
  product_name: string;
  product_code: string | null;
  unit_price: number | null;
  unit: string | null;
  category: string | null;
}

interface ImportResult {
  catalogueId: string;
  catalogueName: string;
  totalProcessed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
  totalErrors: number;
}

type Step = "upload" | "mapping" | "validation" | "importing" | "complete";

// ============================================================================
// CONSTANTS
// ============================================================================

const SYSTEM_FIELDS = [
  { key: "product_name", label: "Product Name", required: true, description: "The name of the product" },
  { key: "product_code", label: "Product Code (SKU)", required: false, description: "Unique identifier for the product" },
  { key: "unit_price", label: "Unit Price", required: true, description: "Price per unit" },
  { key: "unit", label: "Unit", required: false, description: "Unit of measurement (e.g., kg, piece)" },
  { key: "category", label: "Category", required: false, description: "Product category or group" },
] as const;

const ACCEPTED_FILE_TYPES = ".xlsx,.xls,.csv";
const MAX_FILE_SIZE_MB = 10;

// ============================================================================
// COMPONENT
// ============================================================================

export default function CatalogueUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  
  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  
  // Catalogue details
  const [catalogueName, setCatalogueName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  
  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    product_name: "",
    product_code: "",
    unit_price: "",
    unit: "",
    category: "",
  });
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls") && !ext.endsWith(".csv")) {
      toast.error("Invalid file type. Please upload .xlsx, .xls, or .csv files only.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/catalogues/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to upload file");
      }

      setFilePreview(result.data);
      
      // Auto-suggest catalogue name from file name
      if (!catalogueName) {
        const suggestedName = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
        setCatalogueName(suggestedName);
      }

      // Try to auto-detect column mappings
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
      product_code: "",
      unit_price: "",
      unit: "",
      category: "",
    };

    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Product name detection
    const namePatterns = ["product name", "product", "name", "item", "description", "ürün adı", "ürün"];
    for (const pattern of namePatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.product_name = headers[idx];
        break;
      }
    }

    // Product code/SKU detection
    const codePatterns = ["sku", "code", "product code", "item code", "barcode", "upc", "kod"];
    for (const pattern of codePatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.product_code = headers[idx];
        break;
      }
    }

    // Price detection
    const pricePatterns = ["price", "unit price", "cost", "amount", "fiyat", "birim fiyat"];
    for (const pattern of pricePatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.unit_price = headers[idx];
        break;
      }
    }

    // Unit detection
    const unitPatterns = ["unit", "uom", "measurement", "birim"];
    for (const pattern of unitPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.unit = headers[idx];
        break;
      }
    }

    // Category detection
    const categoryPatterns = ["category", "group", "type", "kategori", "grup"];
    for (const pattern of categoryPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        newMapping.category = headers[idx];
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
      product_code: "",
      unit_price: "",
      unit: "",
      category: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validateMapping = async () => {
    if (!filePreview) return;

    setIsValidating(true);
    setCurrentStep("validation");

    try {
      // Build mapping object - only include fields that have values
      const mappingPayload: Record<string, string> = {
        product_name: mapping.product_name,
        unit_price: mapping.unit_price,
      };
      
      if (mapping.product_code) mappingPayload.product_code = mapping.product_code;
      if (mapping.unit) mappingPayload.unit = mapping.unit;
      if (mapping.category) mappingPayload.category = mapping.category;

      console.log("Sending validation request with mapping:", mappingPayload);
      console.log("Data rows:", filePreview.previewData.length);

      const response = await fetch("/api/catalogues/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filePreview.previewData,
          mapping: mappingPayload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Validation result:", result);

      if (!result.success) {
        throw new Error(result.error || "Validation failed");
      }

      setValidationResult(result.data);
    } catch (error) {
      console.error("Validation error:", error);
      toast.error(error instanceof Error ? error.message : "Validation failed");
      setCurrentStep("mapping");
    } finally {
      setIsValidating(false);
    }
  };

  // ==========================================================================
  // IMPORT
  // ==========================================================================

  const handleImport = async () => {
    if (!filePreview || !catalogueName) return;

    setIsImporting(true);
    setCurrentStep("importing");
    setImportProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      // Re-upload and get full data for import
      const formData = new FormData();
      formData.append("file", selectedFile!);
      formData.append("fullData", "true"); // Request all rows

      const uploadResponse = await fetch("/api/catalogues/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to process file");
      }

      // Build mapping object - only include non-empty optional fields
      const mappingPayload = {
        product_name: mapping.product_name,
        unit_price: mapping.unit_price,
        ...(mapping.product_code && { product_code: mapping.product_code }),
        ...(mapping.unit && { unit: mapping.unit }),
        ...(mapping.category && { category: mapping.category }),
      };

      // Import with full data
      const response = await fetch("/api/catalogues/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogueName,
          currency,
          fileName: selectedFile!.name,
          data: uploadResult.data.allData || uploadResult.data.previewData,
          mapping: mappingPayload,
          skipDuplicates,
        }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const result = await response.json();

      if (!result.success) {
        // Check if it's a validation error
        if (result.validationResult) {
          setValidationResult(result.validationResult);
          setCurrentStep("validation");
          toast.error("Please fix validation errors before importing");
          return;
        }
        throw new Error(result.error || "Import failed");
      }

      setImportResult(result.data);
      setCurrentStep("complete");
      toast.success(`Successfully imported ${result.data.imported} products!`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "Import failed");
      setCurrentStep("validation");
    } finally {
      clearInterval(progressInterval);
      setIsImporting(false);
    }
  };

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  const canProceedToMapping = (): boolean => {
    return !!filePreview && !!catalogueName.trim();
  };

  const canProceedToValidation = (): boolean => {
    return !!mapping.product_name && !!mapping.unit_price;
  };

  const goToMapping = () => {
    if (canProceedToMapping()) {
      setCurrentStep("mapping");
    }
  };

  const goBackToUpload = () => {
    setCurrentStep("upload");
    setValidationResult(null);
  };

  const goBackToMapping = () => {
    setCurrentStep("mapping");
    setValidationResult(null);
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStepProgress = (): number => {
    switch (currentStep) {
      case "upload": return 0;
      case "mapping": return 33;
      case "validation": return 66;
      case "importing": return 85;
      case "complete": return 100;
      default: return 0;
    }
  };

  // ==========================================================================
  // RENDER: STEP 1 - UPLOAD
  // ==========================================================================

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* File Drop Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Upload your Excel or CSV file containing product data
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
                    Drag and drop your file here
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

      {/* Catalogue Details */}
      {filePreview && (
        <Card>
          <CardHeader>
            <CardTitle>Catalogue Details</CardTitle>
            <CardDescription>
              Configure your new catalogue settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalogueName">Catalogue Name *</Label>
              <Input
                id="catalogueName"
                value={catalogueName}
                onChange={(e) => setCatalogueName(e.target.value)}
                placeholder="Enter catalogue name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
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
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {filePreview && filePreview.previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Preview</CardTitle>
            <CardDescription>
              First {Math.min(filePreview.previewData.length, 5)} rows of your data
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

      {/* Next Button */}
      {filePreview && (
        <div className="flex justify-end">
          <Button 
            onClick={goToMapping} 
            disabled={!canProceedToMapping()}
            size="lg"
          >
            Continue to Column Mapping
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 2 - COLUMN MAPPING
  // ==========================================================================

  const renderMappingStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map Columns</CardTitle>
          <CardDescription>
            Match your file columns to the system fields. Required fields are marked with *.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SYSTEM_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Label className="flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {field.description}
                  </p>
                </div>
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
                      <span className="text-muted-foreground">-- Ignore this field --</span>
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

      {/* Mapping Preview */}
      {mapping.product_name && mapping.unit_price && filePreview && (
        <Card>
          <CardHeader>
            <CardTitle>Mapping Preview</CardTitle>
            <CardDescription>
              See how your data will be imported
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filePreview.previewData.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {mapping.product_name ? String(row[mapping.product_name] ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {mapping.product_code ? String(row[mapping.product_code] ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {mapping.unit_price ? String(row[mapping.unit_price] ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {mapping.unit ? String(row[mapping.unit] ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {mapping.category ? String(row[mapping.category] ?? "-") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBackToUpload}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={validateMapping} 
          disabled={!canProceedToValidation() || isValidating}
          size="lg"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              Validate & Preview
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 3 - VALIDATION
  // ==========================================================================

  const renderValidationStep = () => (
    <div className="space-y-6">
      {validationResult && (
        <>
          {/* Validation Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{validationResult.validRowCount}</p>
                    <p className="text-sm text-muted-foreground">Valid Rows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-500/10">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{validationResult.invalidRowCount}</p>
                    <p className="text-sm text-muted-foreground">Invalid Rows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-500/10">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{validationResult.duplicateCodes.length}</p>
                    <p className="text-sm text-muted-foreground">Duplicate Codes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Validation Errors Found</AlertTitle>
              <AlertDescription>
                <div className="mt-2 max-h-40 overflow-auto">
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {validationResult.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>
                        Row {error.row}: {error.message}
                        {error.field !== "import" && ` (${error.field})`}
                      </li>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <li className="text-muted-foreground">
                        ... and {validationResult.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate handling */}
          {validationResult.duplicateCodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Duplicate Product Codes</CardTitle>
                <CardDescription>
                  The following product codes appear multiple times in your file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {validationResult.duplicateCodes.slice(0, 10).map((code) => (
                    <Badge key={code} variant="secondary">{code}</Badge>
                  ))}
                  {validationResult.duplicateCodes.length > 10 && (
                    <Badge variant="outline">+{validationResult.duplicateCodes.length - 10} more</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Skip duplicate entries (keep first occurrence)</span>
                  </div>
                  <Switch
                    checked={skipDuplicates}
                    onCheckedChange={setSkipDuplicates}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Review your mapped data before importing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.previewData.map((row) => {
                      const hasError = validationResult.errors.some(e => e.row === row.rowIndex);
                      return (
                        <TableRow key={row.rowIndex} className={hasError ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="text-muted-foreground">{row.rowIndex}</TableCell>
                          <TableCell className="font-medium">{row.product_name || <span className="text-red-500">Missing</span>}</TableCell>
                          <TableCell>{row.product_code || "-"}</TableCell>
                          <TableCell>
                            {row.unit_price !== null ? (
                              row.unit_price.toFixed(2)
                            ) : (
                              <span className="text-red-500">Invalid</span>
                            )}
                          </TableCell>
                          <TableCell>{row.unit || "-"}</TableCell>
                          <TableCell>{row.category || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBackToMapping}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Mapping
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={
            isImporting || 
            (validationResult?.invalidRowCount ?? 0) > 0 && 
            !skipDuplicates
          }
          size="lg"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import {validationResult?.validRowCount || 0} Products
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: STEP 4 - IMPORTING
  // ==========================================================================

  const renderImportingStep = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Importing Products</h3>
              <p className="text-muted-foreground">Please wait while we process your data...</p>
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
  // RENDER: STEP 5 - COMPLETE
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
                    Your catalogue &quot;{importResult.catalogueName}&quot; has been created
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{importResult.totalProcessed}</p>
                <p className="text-sm text-muted-foreground">Total Processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">New Products</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-blue-600">{importResult.updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-yellow-600">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/catalogues")}
            >
              View All Catalogues
            </Button>
            <Button
              onClick={() => router.push(`/catalogues/${importResult.catalogueId}`)}
            >
              View Imported Catalogue
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
        <Link href="/catalogues">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Catalogues
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Catalogue</h1>
        <p className="text-muted-foreground">
          Upload an Excel or CSV file to create a new product catalogue
        </p>
      </div>

      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className={currentStep === "upload" ? "text-primary font-medium" : "text-muted-foreground"}>
            1. Upload
          </span>
          <span className={currentStep === "mapping" ? "text-primary font-medium" : "text-muted-foreground"}>
            2. Map Columns
          </span>
          <span className={currentStep === "validation" ? "text-primary font-medium" : "text-muted-foreground"}>
            3. Validate
          </span>
          <span className={currentStep === "complete" || currentStep === "importing" ? "text-primary font-medium" : "text-muted-foreground"}>
            4. Complete
          </span>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
      </div>

      {/* Step content */}
      {currentStep === "upload" && renderUploadStep()}
      {currentStep === "mapping" && renderMappingStep()}
      {currentStep === "validation" && renderValidationStep()}
      {currentStep === "importing" && renderImportingStep()}
      {currentStep === "complete" && renderCompleteStep()}
    </div>
  );
}
