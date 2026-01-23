"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, FileText, MoreHorizontal, Trash2, Eye, FileCheck, Loader2, Upload } from "lucide-react";
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
import { formatPrice } from "@/lib/currency";

interface InvoiceData {
  id: string;
  supplierName: string | null;
  originalFileName: string;
  invoiceDate: string | null;
  totalAmount: number | null;
  language: string;
  currency: string;
  status: string;
  createdAt: string;
  _count: {
    items: number;
  };
}

async function fetchInvoices(): Promise<InvoiceData[]> {
  const response = await fetch("/api/invoices");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function deleteInvoice(id: string): Promise<void> {
  const response = await fetch(`/api/invoices/${id}`, {
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

export default function InvoicesPage() {
  const queryClient = useQueryClient();

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete invoice");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Manage your invoices</p>
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
        <p className="text-muted-foreground">Failed to load invoices</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage and verify your invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/invoices/upload">
              <Upload className="mr-2 h-4 w-4" />
              Import from File
            </Link>
          </Button>
          <Button asChild>
            <Link href="/invoices/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Invoices list */}
      {invoices && invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first invoice to start verifying prices
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/invoices/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Import from File
                </Link>
              </Button>
              <Button asChild>
                <Link href="/invoices/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {invoices?.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg line-clamp-1">
                      {invoice.supplierName || "Unknown Supplier"}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {invoice.originalFileName}
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
                        <Link href={`/invoices/${invoice.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {invoice.status === "COMPLETED" && (
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${invoice.id}?verify=true`}>
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
                            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this invoice? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(invoice.id)}
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
                      <StatusBadge status={invoice.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice._count.items} items
                    </p>
                  </div>
                  <div className="text-right">
                    {invoice.totalAmount && (
                      <p className="font-semibold">
                        {formatPrice(invoice.totalAmount, invoice.currency || "USD")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {invoice.invoiceDate
                        ? format(new Date(invoice.invoiceDate), "MMM d, yyyy")
                        : format(new Date(invoice.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/invoices/${invoice.id}`}>View Details</Link>
                  </Button>
                  {invoice.status === "COMPLETED" && (
                    <Button asChild className="flex-1">
                      <Link href={`/invoices/${invoice.id}?verify=true`}>
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
