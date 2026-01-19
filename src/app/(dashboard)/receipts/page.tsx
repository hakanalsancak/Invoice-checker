"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Receipt, MoreHorizontal, Trash2, Eye, FileCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TableSkeleton } from "@/components/shared/LoadingStates";

interface ReceiptData {
  id: string;
  supplierName: string | null;
  originalFileName: string;
  receiptDate: string | null;
  totalAmount: number | null;
  language: string;
  status: string;
  createdAt: string;
  _count: {
    items: number;
  };
}

async function fetchReceipts(): Promise<ReceiptData[]> {
  const response = await fetch("/api/receipts");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function deleteReceipt(id: string): Promise<void> {
  const response = await fetch(`/api/receipts/${id}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
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

export default function ReceiptsPage() {
  const queryClient = useQueryClient();

  const { data: receipts, isLoading, error } = useQuery({
    queryKey: ["receipts"],
    queryFn: fetchReceipts,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete receipt");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
            <p className="text-muted-foreground">Manage your receipts and invoices</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={5} columns={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load receipts</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Manage and verify your receipts and invoices
          </p>
        </div>
        <Button asChild>
          <Link href="/receipts/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload Receipt
          </Link>
        </Button>
      </div>

      {/* Receipts list */}
      {receipts && receipts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No receipts yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload your first receipt to start verifying prices
            </p>
            <Button asChild>
              <Link href="/receipts/upload">
                <Plus className="mr-2 h-4 w-4" />
                Upload Receipt
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {receipts?.map((receipt) => (
            <Card key={receipt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg line-clamp-1">
                      {receipt.supplierName || "Unknown Supplier"}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {receipt.originalFileName}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/receipts/${receipt.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {receipt.status === "COMPLETED" && (
                        <DropdownMenuItem asChild>
                          <Link href={`/receipts/${receipt.id}?verify=true`}>
                            <FileCheck className="mr-2 h-4 w-4" />
                            Verify Prices
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this receipt? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(receipt.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={receipt.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {receipt._count.items} items
                    </p>
                  </div>
                  <div className="text-right">
                    {receipt.totalAmount && (
                      <p className="font-semibold">
                        ₺{Number(receipt.totalAmount).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {receipt.receiptDate
                        ? format(new Date(receipt.receiptDate), "MMM d, yyyy")
                        : format(new Date(receipt.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/receipts/${receipt.id}`}>View Details</Link>
                  </Button>
                  {receipt.status === "COMPLETED" && (
                    <Button asChild className="flex-1">
                      <Link href={`/receipts/${receipt.id}?verify=true`}>
                        <FileCheck className="mr-2 h-4 w-4" />
                        Verify
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
