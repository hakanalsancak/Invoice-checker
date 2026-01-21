"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BarChart3, MoreHorizontal, Trash2, Eye, Download, Loader2 } from "lucide-react";
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

interface Report {
  id: string;
  totalItems: number;
  matchedItems: number;
  mismatches: number;
  totalOvercharge: number;
  totalUndercharge: number;
  createdAt: string;
  receipt: {
    id: string;
    supplierName: string | null;
    originalFileName: string;
    receiptDate: string | null;
  };
  catalogue: {
    id: string;
    name: string;
  };
}

async function fetchReports(): Promise<Report[]> {
  const response = await fetch("/api/reports");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function deleteReport(id: string): Promise<void> {
  const response = await fetch(`/api/reports/${id}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
}

async function downloadCSV(id: string): Promise<void> {
  const response = await fetch(`/api/reports/${id}?format=csv`);
  if (!response.ok) throw new Error("Failed to download");
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${id}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export default function ReportsPage() {
  const queryClient = useQueryClient();

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete report");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View your price comparison reports</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and manage your price comparison reports
        </p>
      </div>

      {/* Reports list */}
      {reports && reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload a receipt and verify prices to generate your first report
            </p>
            <Button asChild>
              <Link href="/receipts/upload">Upload Receipt</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Reports</CardTitle>
            <CardDescription>
              All your price verification reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt / Supplier</TableHead>
                    <TableHead>Catalogue</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Overcharge</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports?.map((report) => {
                    const matchRate = report.totalItems > 0
                      ? Math.round((report.matchedItems / report.totalItems) * 100)
                      : 0;
                    
                    return (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {report.receipt.supplierName || "Unknown Supplier"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {report.receipt.originalFileName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{report.catalogue.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{report.matchedItems}/{report.totalItems}</span>
                            <Badge
                              variant={
                                matchRate >= 90
                                  ? "default"
                                  : matchRate >= 70
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {matchRate}% matched
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {Number(report.totalOvercharge) > 0 ? (
                            <span className="text-destructive font-medium">
                              +₺{Number(report.totalOvercharge).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">₺0.00</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(report.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button asChild variant="default" size="sm">
                              <Link href={`/reports/${report.id}`}>
                                <Eye className="mr-1 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => downloadCSV(report.id)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export CSV
                                </DropdownMenuItem>
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
                                      <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this report? This
                                        action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteMutation.mutate(report.id)}
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
