"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
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

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
];

interface CreateData {
  supplierName: string;
  receiptDate?: string;
  currency: string;
}

async function createReceipt(data: CreateData) {
  const response = await fetch("/api/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export default function CreateReceiptPage() {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [currency, setCurrency] = useState("USD");

  const createMutation = useMutation({
    mutationFn: createReceipt,
    onSuccess: (data) => {
      toast.success("Receipt created! Now add your items.");
      router.push(`/receipts/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create receipt");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      toast.error("Please enter a supplier name");
      return;
    }

    createMutation.mutate({
      supplierName: supplierName.trim(),
      receiptDate: receiptDate || undefined,
      currency,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/receipts">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Receipts
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Receipt</h1>
        <p className="text-muted-foreground">
          Create a new receipt or invoice to verify prices against your catalogues
        </p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
          <CardDescription>
            Enter the basic details for your receipt. You&apos;ll be able to add line items after creating it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Supplier name */}
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name *</Label>
              <Input
                id="supplierName"
                placeholder="e.g., Kapriss Furniture Ltd."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={createMutation.isPending}
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                The name of the supplier/vendor on the invoice
              </p>
            </div>

            {/* Receipt date */}
            <div className="space-y-2">
              <Label htmlFor="receiptDate">Receipt Date</Label>
              <Input
                id="receiptDate"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                disabled={createMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                The date on the invoice/receipt
              </p>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={createMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The currency of prices on this receipt
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={!supplierName.trim() || createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Receipt"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/receipts")}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Next steps info */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create the receipt with supplier name and currency</p>
          <p>2. Add line items manually (product, quantity, price)</p>
          <p>3. Click &quot;Verify Prices&quot; to compare against a catalogue</p>
          <p>4. Get instant price verification report</p>
        </CardContent>
      </Card>
    </div>
  );
}
