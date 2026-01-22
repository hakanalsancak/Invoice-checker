"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
} from "lucide-react";
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
import { CatalogueWithItems, CatalogueItemDisplay } from "@/types";
import { formatPrice, getCurrencySymbol, SUPPORTED_CURRENCIES } from "@/lib/currency";

async function fetchCatalogue(id: string): Promise<CatalogueWithItems> {
  const response = await fetch(`/api/catalogues/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function updateItem(catalogueId: string, itemId: string, data: Partial<CatalogueItemDisplay>) {
  const response = await fetch(`/api/catalogues/${catalogueId}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, ...data }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function deleteItem(catalogueId: string, itemId: string) {
  const response = await fetch(`/api/catalogues/${catalogueId}/items?itemId=${itemId}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function createItem(catalogueId: string, data: { productName: string; price: number; description?: string }) {
  const response = await fetch(`/api/catalogues/${catalogueId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function updateCatalogueCurrency(catalogueId: string, currency: string) {
  const response = await fetch(`/api/catalogues/${catalogueId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currency }),
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

interface EditingItem {
  id: string;
  productName: string;
  price: string;
  description: string;
}

export default function CatalogueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalogueId = params.id as string;

  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [newItem, setNewItem] = useState({
    productName: "",
    price: "",
    description: "",
  });

  const { data: catalogue, isLoading, error } = useQuery({
    queryKey: ["catalogue", catalogueId],
    queryFn: () => fetchCatalogue(catalogueId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<CatalogueItemDisplay> }) =>
      updateItem(catalogueId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue", catalogueId] });
      setEditingItem(null);
      toast.success("Item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(catalogueId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue", catalogueId] });
      toast.success("Item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete item");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { productName: string; price: number; description?: string }) =>
      createItem(catalogueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue", catalogueId] });
      setIsAddingItem(false);
      setNewItem({ productName: "", price: "", description: "" });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add item");
    },
  });

  const currencyMutation = useMutation({
    mutationFn: (currency: string) => updateCatalogueCurrency(catalogueId, currency),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue", catalogueId] });
      setCurrencyDialogOpen(false);
      toast.success("Currency updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update currency");
    },
  });

  const openCurrencyDialog = () => {
    setSelectedCurrency(catalogue?.currency || "GBP");
    setCurrencyDialogOpen(true);
  };

  const handleCurrencyChange = () => {
    if (selectedCurrency) {
      currencyMutation.mutate(selectedCurrency);
    }
  };

  if (isLoading) return <PageLoading />;

  if (error || !catalogue) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Catalogue not found</p>
        <Button asChild variant="outline">
          <Link href="/catalogues">Back to Catalogues</Link>
        </Button>
      </div>
    );
  }

  const filteredItems = catalogue.items.filter((item) =>
    item.productName.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEditClick = (item: CatalogueItemDisplay) => {
    setEditingItem({
      id: item.id,
      productName: item.productName,
      price: String(item.price),
      description: item.category || "", // Using category field as description
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateMutation.mutate({
      itemId: editingItem.id,
      data: {
        productName: editingItem.productName,
        price: parseFloat(editingItem.price),
        category: editingItem.description || null, // Store description in category field
      },
    });
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.price) {
      toast.error("Product name and price are required");
      return;
    }
    createMutation.mutate({
      productName: newItem.productName,
      price: parseFloat(newItem.price),
      description: newItem.description || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/catalogues">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Catalogues
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{catalogue.name}</h1>
            <StatusBadge status={catalogue.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground mt-2">
            <span>Created on {format(new Date(catalogue.createdAt), "MMMM d, yyyy")}</span>
            <span>•</span>
            <span>{catalogue.items.length} items</span>
            <span>•</span>
            <button 
              onClick={openCurrencyDialog}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Currency: {getCurrencySymbol(catalogue.currency)} {catalogue.currency}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>
                Add a new product to this catalogue
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={newItem.productName}
                  onChange={(e) => setNewItem({ ...newItem, productName: e.target.value })}
                  placeholder="Enter product name"
                />
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Notes</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Optional - any additional info (size, type, etc.)"
                />
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
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Catalogue Items</CardTitle>
              <CardDescription>
                All products and prices in this catalogue
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="w-32">Price</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      {search ? "No items match your search" : "No items in this catalogue. Click 'Add Item' to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      {editingItem?.id === item.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={editingItem.productName}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, productName: e.target.value })
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem.price}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, price: e.target.value })
                              }
                              className="h-8 w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editingItem.description}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, description: e.target.value })
                              }
                              className="h-8"
                              placeholder="Optional"
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
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{formatPrice(Number(item.price), catalogue.currency)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.category || "-"}
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
        </CardContent>
      </Card>

      {/* Currency Edit Dialog */}
      <Dialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Currency</DialogTitle>
            <DialogDescription>
              Select the correct currency for this catalogue. This will affect how prices are displayed and compared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SUPPORTED_CURRENCIES.map((currency) => (
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
              disabled={currencyMutation.isPending || selectedCurrency === catalogue?.currency}
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
