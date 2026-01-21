"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
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

interface Catalogue {
  id: string;
  name: string;
  _count: { items: number };
}

interface EditingItem {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

async function fetchReceipt(id: string): Promise<ReceiptWithItems> {
  const response = await fetch(`/api/receipts/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function fetchCatalogues(): Promise<Catalogue[]> {
  const response = await fetch("/api/catalogues");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data.filter((c: { status: string }) => c.status === "COMPLETED");
}

async function verifyReceipt(receiptId: string, catalogueId: string) {
  const response = await fetch(`/api/receipts/${receiptId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalogueId }),
  });
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

async function createItem(receiptId: string, data: { productName: string; quantity: number; unit?: string; unitPrice: number; totalPrice: number }) {
  const response = await fetch(`/api/receipts/${receiptId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
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

  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedCatalogue, setSelectedCatalogue] = useState<string>("");
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    productName: "",
    quantity: "1",
    unit: "",
    unitPrice: "",
    totalPrice: "",
  });

  useEffect(() => {
    if (showVerify) {
      setVerifyDialogOpen(true);
    }
  }, [showVerify]);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ["receipt", receiptId],
    queryFn: () => fetchReceipt(receiptId),
  });

  const { data: catalogues } = useQuery({
    queryKey: ["catalogues"],
    queryFn: fetchCatalogues,
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyReceipt(receiptId, selectedCatalogue),
    onSuccess: (data) => {
      toast.success("Price verification completed!");
      router.push(`/reports/${data.reportId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify prices");
    },
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
    mutationFn: (data: { productName: string; quantity: number; unit?: string; unitPrice: number; totalPrice: number }) =>
      createItem(receiptId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      setIsAddingItem(false);
      setNewItem({ productName: "", quantity: "1", unit: "", unitPrice: "", totalPrice: "" });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add item");
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

  const handleVerify = () => {
    if (!selectedCatalogue) {
      toast.error("Please select a catalogue to compare against");
      return;
    }
    verifyMutation.mutate();
  };

  const handleEditClick = (item: ReceiptItemDisplay) => {
    setEditingItem({
      id: item.id,
      productName: item.productName,
      quantity: String(item.quantity),
      unit: item.unit || "",
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.totalPrice),
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateMutation.mutate({
      itemId: editingItem.id,
      data: {
        productName: editingItem.productName,
        quantity: parseFloat(editingItem.quantity),
        unit: editingItem.unit || null,
        unitPrice: parseFloat(editingItem.unitPrice),
        totalPrice: parseFloat(editingItem.totalPrice),
      },
    });
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.unitPrice) {
      toast.error("Product name and unit price are required");
      return;
    }
    const qty = parseFloat(newItem.quantity) || 1;
    const unitPrice = parseFloat(newItem.unitPrice) || 0;
    const totalPrice = newItem.totalPrice ? parseFloat(newItem.totalPrice) : qty * unitPrice;
    
    createMutation.mutate({
      productName: newItem.productName,
      quantity: qty,
      unit: newItem.unit || undefined,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
    });
  };

  // Auto-calculate total when quantity or unit price changes in edit mode
  const handleEditFieldChange = (field: keyof EditingItem, value: string) => {
    if (!editingItem) return;
    
    const updated = { ...editingItem, [field]: value };
    
    // Auto-calculate total price
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated.quantity) || 0;
      const price = parseFloat(updated.unitPrice) || 0;
      updated.totalPrice = (qty * price).toFixed(2);
    }
    
    setEditingItem(updated);
  };

  // Auto-calculate for new item
  const handleNewItemChange = (field: string, value: string) => {
    const updated = { ...newItem, [field]: value };
    
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated.quantity) || 0;
      const price = parseFloat(updated.unitPrice) || 0;
      updated.totalPrice = (qty * price).toFixed(2);
    }
    
    setNewItem(updated);
  };

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
          <p className="text-muted-foreground mt-1">{receipt.originalFileName}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
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
                <span>Total: {formatPrice(receipt.totalAmount, receipt.currency || "USD")}</span>
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
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription>
                  Add a missing item to this receipt
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={newItem.productName}
                    onChange={(e) => handleNewItemChange("productName", e.target.value)}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => handleNewItemChange("quantity", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      value={newItem.unit}
                      onChange={(e) => handleNewItemChange("unit", e.target.value)}
                      placeholder="SET, PCS, etc."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newItem.unitPrice}
                      onChange={(e) => handleNewItemChange("unitPrice", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newItem.totalPrice}
                      onChange={(e) => setNewItem({ ...newItem, totalPrice: e.target.value })}
                      placeholder="Auto-calculated"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingItem(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddItem} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Item"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {receipt.status === "COMPLETED" && (
            <Button onClick={() => setVerifyDialogOpen(true)}>
              <FileCheck className="mr-2 h-4 w-4" />
              Verify Prices
            </Button>
          )}
        </div>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Items</CardTitle>
          <CardDescription>
            All items extracted from this receipt. Click the pencil icon to edit any item.
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
                  <TableHead className="w-28">Unit Price</TableHead>
                  <TableHead className="w-28">Total</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No items found in this receipt
                    </TableCell>
                  </TableRow>
                ) : (
                  receipt.items.map((item) => (
                    <TableRow key={item.id}>
                      {editingItem?.id === item.id ? (
                        <>
                          <TableCell className="text-muted-foreground">
                            {item.lineNumber}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editingItem.productName}
                              onChange={(e) => handleEditFieldChange("productName", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={editingItem.quantity}
                                onChange={(e) => handleEditFieldChange("quantity", e.target.value)}
                                className="h-8 w-16"
                              />
                              <Input
                                value={editingItem.unit}
                                onChange={(e) => handleEditFieldChange("unit", e.target.value)}
                                className="h-8 w-14"
                                placeholder="unit"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem.unitPrice}
                              onChange={(e) => handleEditFieldChange("unitPrice", e.target.value)}
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem.totalPrice}
                              onChange={(e) => handleEditFieldChange("totalPrice", e.target.value)}
                              className="h-8 w-24"
                            />
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
                          <TableCell className="text-muted-foreground">
                            {item.lineNumber}
                          </TableCell>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {Number(item.quantity)} {item.unit || ""}
                          </TableCell>
                          <TableCell>{formatPrice(item.unitPrice, receipt.currency || "USD")}</TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(item.totalPrice, receipt.currency || "USD")}
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
          {receipt.totalAmount && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold">{formatPrice(receipt.totalAmount, receipt.currency || "USD")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Prices</DialogTitle>
            <DialogDescription>
              Select a price catalogue to compare this receipt against. The system
              will match products and identify any price discrepancies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Catalogue</Label>
              <Select value={selectedCatalogue} onValueChange={setSelectedCatalogue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a catalogue..." />
                </SelectTrigger>
                <SelectContent>
                  {catalogues?.map((catalogue) => (
                    <SelectItem key={catalogue.id} value={catalogue.id}>
                      {catalogue.name} ({catalogue._count.items} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!catalogues || catalogues.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No catalogues available.{" "}
                  <Link href="/catalogues/upload" className="text-primary underline">
                    Upload one first
                  </Link>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!selectedCatalogue || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Start Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Currency Edit Dialog */}
      <Dialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Currency</DialogTitle>
            <DialogDescription>
              Select the correct currency for this receipt. This will affect how prices are displayed and converted during comparison.
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
