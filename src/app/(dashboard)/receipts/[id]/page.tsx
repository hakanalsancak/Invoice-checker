"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ReceiptWithItems } from "@/types";

interface Catalogue {
  id: string;
  name: string;
  _count: { items: number };
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
  const receiptId = params.id as string;
  const showVerify = searchParams.get("verify") === "true";

  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedCatalogue, setSelectedCatalogue] = useState<string>("");

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
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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
                <span>Total: ₺{Number(receipt.totalAmount).toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
        {receipt.status === "COMPLETED" && (
          <Button onClick={() => setVerifyDialogOpen(true)}>
            <FileCheck className="mr-2 h-4 w-4" />
            Verify Prices
          </Button>
        )}
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Items</CardTitle>
          <CardDescription>
            All items extracted from this receipt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No items found in this receipt
                    </TableCell>
                  </TableRow>
                ) : (
                  receipt.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        {item.lineNumber}
                      </TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>
                        {Number(item.quantity)} {item.unit || ""}
                      </TableCell>
                      <TableCell>₺{Number(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="font-medium">
                        ₺{Number(item.totalPrice).toFixed(2)}
                      </TableCell>
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
                <p className="text-2xl font-bold">₺{Number(receipt.totalAmount).toFixed(2)}</p>
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
    </div>
  );
}
