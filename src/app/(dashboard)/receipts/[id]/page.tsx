"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2, Pencil, Plus, Save, Trash2, X, Search, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/shared/LoadingStates";
import { ReceiptWithItems, ReceiptItemDisplay } from "@/types";
import { formatPrice, getCurrencySymbol } from "@/lib/currency";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
];

interface CatalogueItem {
  id: string;
  productName: string;
  price: number;
  category: string | null;
  catalogueId: string;
  catalogueName: string;
  catalogueCurrency: string;
}

interface LinkedCatalogue {
  id: string;
  name: string;
  currency: string;
}

interface ReceiptWithCatalogues extends ReceiptWithItems {
  catalogues?: Array<{
    catalogue: LinkedCatalogue;
  }>;
}

interface EditingItem {
  id: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

async function fetchReceipt(id: string): Promise<ReceiptWithCatalogues> {
  const response = await fetch(`/api/receipts/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function fetchCatalogueItems(catalogueIds: string[]): Promise<CatalogueItem[]> {
  if (catalogueIds.length === 0) return [];
  
  const response = await fetch(`/api/receipts/catalogue-items?ids=${catalogueIds.join(",")}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function updateReceiptCurrency(receiptId: string, currency: string) {
  const response = await fetch(`/api/receipts/${receiptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currency }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function updateItem(receiptId: string, itemId: string, data: Partial<ReceiptItemDisplay>) {
  const response = await fetch(`/api/receipts/${receiptId}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, ...data }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function deleteItem(receiptId: string, itemId: string) {
  const response = await fetch(`/api/receipts/${receiptId}/items?itemId=${itemId}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function createItem(receiptId: string, data: { 
  catalogueItemId: string;
  productName: string; 
  quantity: number; 
  unitPrice: number; 
  totalPrice: number;
}) {
  const response = await fetch(`/api/receipts/${receiptId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function verifyReceipt(receiptId: string) {
  const response = await fetch(`/api/receipts/${receiptId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    PENDING: { variant: "secondary", label: "Pending" },
    PROCESSING: { variant: "outline", label: "Processing" },
    COMPLETED: { variant: "default", label: "Completed" },
    FAILED: { variant: "destructive", label: "Failed" },
  };
  const { variant, label } = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const receiptId = params.id as string;
  const showVerify = searchParams.get("verify") === "true";

  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogueItem | null>(null);
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");

  useEffect(() => {
    if (showVerify) {
      // Auto-start verification if verify=true in URL
    }
  }, [showVerify]);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ["receipt", receiptId],
    queryFn: () => fetchReceipt(receiptId),
  });

  // Get linked catalogue IDs
  const linkedCatalogueIds = useMemo(() => {
    return receipt?.catalogues?.map(c => c.catalogue.id) || [];
  }, [receipt?.catalogues]);

  // Fetch items from linked catalogues
  const { data: catalogueItems } = useQuery({
    queryKey: ["catalogueItems", linkedCatalogueIds],
    queryFn: () => fetchCatalogueItems(linkedCatalogueIds),
    enabled: linkedCatalogueIds.length > 0,
  });

  const currencyMutation = useMutation({
    mutationFn: (currency: string) => updateReceiptCurrency(receiptId, currency),
    onSuccess: () => {
      toast.success("Currency updated!");
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      setCurrencyDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update currency");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<ReceiptItemDisplay> }) =>
      updateItem(receiptId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      setEditingItem(null);
      toast.success("Item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(receiptId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      toast.success("Item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete item");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { catalogueItemId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }) =>
      createItem(receiptId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      setIsAddingItem(false);
      setSelectedProduct(null);
      setNewItemQuantity("1");
      setNewItemPrice("");
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add item");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyReceipt(receiptId),
    onSuccess: (data) => {
      toast.success("Price verification completed!");
      router.push(`/reports/${data.reportId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify prices");
    },
  });

  const openCurrencyDialog = () => {
    setSelectedCurrency(receipt?.currency || "USD");
    setCurrencyDialogOpen(true);
  };

  const handleCurrencyChange = () => {
    if (selectedCurrency) {
      currencyMutation.mutate(selectedCurrency);
    }
  };

  if (isLoading) return <PageLoading />;

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Receipt not found</p>
        <Button asChild variant="outline">
          <Link href="/receipts">Back to Receipts</Link>
        </Button>
      </div>
    );
  }

  const handleEditClick = (item: ReceiptItemDisplay) => {
    setEditingItem({
      id: item.id,
      productName: item.productName,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.totalPrice),
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editingItem.quantity) || 1;
    const price = parseFloat(editingItem.unitPrice) || 0;
    updateMutation.mutate({
      itemId: editingItem.id,
      data: {
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price,
      },
    });
  };

  const handleProductSelect = (product: CatalogueItem) => {
    setSelectedProduct(product);
    setProductPickerOpen(false);
    // Don't auto-fill price - user enters the receipt price
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    if (!newItemPrice) {
      toast.error("Please enter the receipt price");
      return;
    }

    const qty = parseFloat(newItemQuantity) || 1;
    const price = parseFloat(newItemPrice) || 0;

    createMutation.mutate({
      catalogueItemId: selectedProduct.id,
      productName: selectedProduct.productName,
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
    });
  };

  // Auto-calculate total when quantity or price changes
  const handleEditFieldChange = (field: keyof EditingItem, value: string) => {
    if (!editingItem) return;
    
    const updated = { ...editingItem, [field]: value };
    
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated.quantity) || 0;
      const price = parseFloat(updated.unitPrice) || 0;
      updated.totalPrice = (qty * price).toFixed(2);
    }
    
    setEditingItem(updated);
  };

  const linkedCatalogues = receipt.catalogues?.map(c => c.catalogue) || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/receipts">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Receipts
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {receipt.supplierName || "Receipt Details"}
            </h1>
            <StatusBadge status={receipt.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
            <span>
              {receipt.receiptDate
                ? format(new Date(receipt.receiptDate), "MMMM d, yyyy")
                : "Date not specified"}
            </span>
            <span>•</span>
            <span>{receipt.items.length} items</span>
            {receipt.totalAmount && (
              <>
                <span>•</span>
                <span>Total: {formatPrice(Number(receipt.totalAmount), receipt.currency || "USD")}</span>
              </>
            )}
            <span>•</span>
            <button 
              onClick={openCurrencyDialog}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Currency: {getCurrencySymbol(receipt.currency || "USD")} {receipt.currency || "USD"}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {/* Linked catalogues */}
          {linkedCatalogues.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Linked to:</span>
              {linkedCatalogues.map(cat => (
                <Badge key={cat.id} variant="outline">{cat.name}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Receipt Item</DialogTitle>
                <DialogDescription>
                  Select a product from your linked catalogues and enter the receipt price
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Product Picker */}
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productPickerOpen}
                        className="w-full justify-between h-auto min-h-10 py-2"
                      >
                        {selectedProduct ? (
                          <div className="text-left">
                            <div className="font-medium">{selectedProduct.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              Catalogue price: {formatPrice(selectedProduct.price, selectedProduct.catalogueCurrency)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Select a product...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={true}>
                        <CommandInput placeholder="Search products..." />
                        <CommandList className="max-h-64">
                          <CommandEmpty>No products found.</CommandEmpty>
                          {linkedCatalogues.map(catalogue => {
                            const catalogueItemsForGroup = catalogueItems?.filter(
                              item => item.catalogueId === catalogue.id
                            ) || [];
                            if (catalogueItemsForGroup.length === 0) return null;
                            return (
                              <CommandGroup key={catalogue.id} heading={catalogue.name}>
                                {catalogueItemsForGroup.map(item => (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.id}__${item.productName}`}
                                    onSelect={(currentValue) => {
                                      const itemId = currentValue.split("__")[0];
                                      const selectedItem = catalogueItems?.find(i => i.id === itemId);
                                      if (selectedItem) {
                                        handleProductSelect(selectedItem);
                                      }
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex-1">
                                      <div>{item.productName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatPrice(item.price, item.catalogueCurrency)}
                                        {item.category && ` • ${item.category}`}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            );
                          })}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Show catalogue price for reference */}
                {selectedProduct && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="font-medium">Catalogue Price (for reference):</div>
                    <div className="text-lg font-bold text-primary">
                      {formatPrice(selectedProduct.price, selectedProduct.catalogueCurrency)}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    placeholder="1"
                  />
                </div>

                {/* Receipt Price */}
                <div className="space-y-2">
                  <Label>Receipt Price (per unit) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Enter the price from the receipt"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the unit price shown on your receipt/invoice
                  </p>
                </div>

                {/* Total preview */}
                {newItemPrice && (
                  <div className="p-3 bg-accent/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Line Total:</div>
                    <div className="text-lg font-bold">
                      {formatPrice(
                        (parseFloat(newItemQuantity) || 1) * (parseFloat(newItemPrice) || 0),
                        receipt.currency || "USD"
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsAddingItem(false);
                  setSelectedProduct(null);
                  setNewItemQuantity("1");
                  setNewItemPrice("");
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddItem} 
                  disabled={!selectedProduct || !newItemPrice || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Item"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {receipt.status === "COMPLETED" && receipt.items.length > 0 && (
            <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Verify Prices
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Items</CardTitle>
          <CardDescription>
            Items from this receipt - click edit to adjust quantity or price
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No items yet. Click &quot;Add Item&quot; to add products from your catalogues.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipt.items.map((item, index) => (
                    <TableRow key={item.id}>
                      {editingItem?.id === item.id ? (
                        <>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={editingItem.quantity}
                              onChange={(e) => handleEditFieldChange("quantity", e.target.value)}
                              className="h-8 w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem.unitPrice}
                              onChange={(e) => handleEditFieldChange("unitPrice", e.target.value)}
                              className="h-8 w-28"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(parseFloat(editingItem.totalPrice) || 0, receipt.currency || "USD")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleSaveEdit}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingItem(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{Number(item.quantity)}</TableCell>
                          <TableCell>{formatPrice(Number(item.unitPrice), receipt.currency || "USD")}</TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(Number(item.totalPrice), receipt.currency || "USD")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditClick(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Total row */}
          {receipt.totalAmount && Number(receipt.totalAmount) > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold">{formatPrice(Number(receipt.totalAmount), receipt.currency || "USD")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency Edit Dialog */}
      <Dialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Currency</DialogTitle>
            <DialogDescription>
              Select the correct currency for this receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency..." />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrencyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCurrencyChange}
              disabled={currencyMutation.isPending || selectedCurrency === receipt?.currency}
            >
              {currencyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Currency"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
