"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

interface Catalogue {
  id: string;
  name: string;
  currency: string;
  _count: { items: number };
}

interface CreateData {
  supplierName: string;
  invoiceDate?: string;
  currency: string;
  catalogueIds: string[];
}

async function fetchCatalogues(): Promise<Catalogue[]> {
  const response = await fetch("/api/catalogues");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data.filter((c: { status: string }) => c.status === "COMPLETED");
}

async function createInvoice(data: CreateData) {
  const response = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [selectedCatalogues, setSelectedCatalogues] = useState<string[]>([]);

  const { data: catalogues, isLoading: cataloguesLoading } = useQuery({
    queryKey: ["catalogues"],
    queryFn: fetchCatalogues,
  });

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (data) => {
      toast.success("Invoice created! Now add your items from the catalogue.");
      router.push(`/invoices/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create invoice");
    },
  });

  const handleCatalogueToggle = (catalogueId: string) => {
    setSelectedCatalogues(prev => 
      prev.includes(catalogueId)
        ? prev.filter(id => id !== catalogueId)
        : [...prev, catalogueId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCatalogues.length === 0) {
      toast.error("Please select at least one catalogue");
      return;
    }

    if (!supplierName.trim()) {
      toast.error("Please enter a supplier name");
      return;
    }

    createMutation.mutate({
      supplierName: supplierName.trim(),
      invoiceDate: invoiceDate || undefined,
      currency,
      catalogueIds: selectedCatalogues,
    });
  };

  const selectedCatalogueNames = catalogues
    ?.filter(c => selectedCatalogues.includes(c.id))
    .map(c => c.name) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/invoices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground">
          Create a new invoice to verify prices against your catalogues
        </p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>
            First, select which catalogue(s) this invoice will be compared against.
            Then you&apos;ll be able to add items from those catalogues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Catalogue Selection */}
            <div className="space-y-3">
              <Label>Select Catalogue(s) *</Label>
              <p className="text-sm text-muted-foreground">
                Choose the catalogue(s) containing the products on this invoice
              </p>
              
              {cataloguesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading catalogues...
                </div>
              ) : catalogues && catalogues.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {catalogues.map((catalogue) => {
                    const isSelected = selectedCatalogues.includes(catalogue.id);
                    return (
                      <div
                        key={catalogue.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                          isSelected ? "bg-accent" : ""
                        }`}
                        onClick={() => handleCatalogueToggle(catalogue.id)}
                      >
                        <div className={`size-4 shrink-0 rounded border flex items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-input"
                        }`}>
                          {isSelected && <Check className="size-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{catalogue.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {catalogue._count.items} items • {catalogue.currency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border rounded-lg">
                  <p className="text-muted-foreground mb-2">No catalogues available</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/catalogues/create">Create a Catalogue First</Link>
                  </Button>
                </div>
              )}

              {/* Selected catalogues display */}
              {selectedCatalogueNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedCatalogueNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier name */}
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name *</Label>
              <Input
                id="supplierName"
                placeholder="Enter supplier name"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={createMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                The name of the supplier/vendor on the invoice
              </p>
            </div>

            {/* Invoice date */}
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Invoice Currency *</Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={createMutation.isPending}
              >
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
              <p className="text-sm text-muted-foreground">
                The currency of prices on this invoice
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={selectedCatalogues.length === 0 || !supplierName.trim() || createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Invoice"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/invoices")}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. <strong>Select catalogue(s)</strong> - Choose which price list(s) to compare against</p>
          <p>2. <strong>Create invoice</strong> - Enter supplier name and currency</p>
          <p>3. <strong>Add items</strong> - Pick products from your selected catalogues</p>
          <p>4. <strong>Verify</strong> - Compare invoice prices against catalogue prices</p>
        </CardContent>
      </Card>

      {/* Alternative: Import */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-3">
              Have an invoice spreadsheet? Import it with smart matching!
            </p>
            <Button variant="outline" asChild>
              <Link href="/invoices/upload">
                Import from Excel/CSV instead
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
