"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { PageLoading } from "@/components/shared/LoadingStates";
import { ComparisonReportWithDetails, ComparisonStatus, MatchConfidence } from "@/types";
import { formatPrice, getCurrencySymbol } from "@/lib/currency";

async function fetchReport(id: string): Promise<ComparisonReportWithDetails> {
  const response = await fetch(`/api/reports/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
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

function StatusIcon({ status }: { status: ComparisonStatus }) {
  switch (status) {
    case "MATCH":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "OVERCHARGE":
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    case "UNDERCHARGE":
      return <TrendingDown className="h-4 w-4 text-blue-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  const variants: Record<MatchConfidence, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    EXACT: { variant: "default", label: "Exact" },
    HIGH: { variant: "default", label: "High" },
    MEDIUM: { variant: "secondary", label: "Medium" },
    LOW: { variant: "outline", label: "Low" },
    UNMATCHED: { variant: "destructive", label: "Unmatched" },
  };

  const { variant, label } = variants[confidence] || { variant: "secondary", label: confidence };
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

function StatusBadge({ status }: { status: ComparisonStatus }) {
  const variants: Record<ComparisonStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
    MATCH: { variant: "default", label: "Match", className: "bg-emerald-500" },
    OVERCHARGE: { variant: "destructive", label: "Overcharge" },
    UNDERCHARGE: { variant: "secondary", label: "Undercharge", className: "bg-blue-500 text-white" },
    UNMATCHED: { variant: "outline", label: "Unmatched" },
  };

  const { variant, label, className } = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={variant} className={className}>{label}</Badge>;
}

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => fetchReport(reportId),
  });

  if (isLoading) return <PageLoading />;

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Report not found</p>
        <Button asChild variant="outline">
          <Link href="/reports">Back to Reports</Link>
        </Button>
      </div>
    );
  }

  const matchRate = report.totalItems > 0
    ? Math.round((report.matchedItems / report.totalItems) * 100)
    : 0;

  const overchargeItems = report.items.filter((i) => i.status === "OVERCHARGE");
  const underchargeItems = report.items.filter((i) => i.status === "UNDERCHARGE");
  const matchedItems = report.items.filter((i) => i.status === "MATCH");
  const unmatchedItems = report.items.filter((i) => i.status === "UNMATCHED");
  const netDifference = Number(report.totalOvercharge) - Number(report.totalUndercharge);

  const handleDownload = async () => {
    try {
      await downloadCSV(reportId);
      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Failed to download report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/reports">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Price Comparison Report
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-muted-foreground">
            <span>{report.receipt.supplierName || "Unknown Supplier"}</span>
            <span>•</span>
            <span>vs {report.catalogue.name}</span>
            <span>•</span>
            <span>{format(new Date(report.createdAt), "MMMM d, yyyy")}</span>
          </div>
          {/* Currency conversion info */}
          {report.receiptCurrency !== report.catalogueCurrency && (
            <div className="mt-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
              <span className="font-medium">Currency Conversion:</span>{" "}
              Receipt ({getCurrencySymbol(report.receiptCurrency)} {report.receiptCurrency}) → 
              Catalogue ({getCurrencySymbol(report.catalogueCurrency)} {report.catalogueCurrency})
              {report.exchangeRate && (
                <span className="ml-2 text-muted-foreground">
                  (Rate: 1 {report.receiptCurrency} = {Number(report.exchangeRate).toFixed(4)} {report.catalogueCurrency})
                </span>
              )}
            </div>
          )}
        </div>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Match Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{matchRate}%</span>
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <Progress value={matchRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {report.matchedItems} of {report.totalItems} items matched
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Overcharge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-destructive">
                +{formatPrice(report.totalOvercharge, report.catalogueCurrency)}
              </span>
              <TrendingUp className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {overchargeItems.length} items overcharged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Undercharge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-500">
                -{formatPrice(report.totalUndercharge, report.catalogueCurrency)}
              </span>
              <TrendingDown className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {underchargeItems.length} items undercharged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span
                className={`text-2xl font-bold ${
                  netDifference > 0
                    ? "text-destructive"
                    : netDifference < 0
                    ? "text-emerald-500"
                    : ""
                }`}
              >
                {netDifference > 0 ? "+" : ""}{formatPrice(Math.abs(netDifference), report.catalogueCurrency)}
              </span>
              <AlertTriangle
                className={`h-5 w-5 ${
                  netDifference > 0
                    ? "text-destructive"
                    : netDifference < 0
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {netDifference > 0
                ? "You were overcharged"
                : netDifference < 0
                ? "You were undercharged"
                : "Prices match"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="px-3 py-1">
          <CheckCircle className="mr-1 h-3 w-3 text-emerald-500" />
          {matchedItems.length} Matched
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          <TrendingUp className="mr-1 h-3 w-3 text-destructive" />
          {overchargeItems.length} Overcharged
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          <TrendingDown className="mr-1 h-3 w-3 text-blue-500" />
          {underchargeItems.length} Undercharged
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          <XCircle className="mr-1 h-3 w-3 text-muted-foreground" />
          {unmatchedItems.length} Unmatched
        </Badge>
      </div>

      {/* Detailed comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Comparison</CardTitle>
          <CardDescription>
            Item-by-item price comparison with discrepancies highlighted
            {report.receiptCurrency !== report.catalogueCurrency && (
              <span className="block mt-1">
                Prices converted from {report.receiptCurrency} to {report.catalogueCurrency} for comparison
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Product (Receipt)</TableHead>
                  <TableHead>Product (Catalogue)</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>
                    Receipt Price
                    <span className="block text-xs text-muted-foreground font-normal">
                      ({report.receiptCurrency})
                    </span>
                  </TableHead>
                  {report.receiptCurrency !== report.catalogueCurrency && (
                    <TableHead>
                      Converted
                      <span className="block text-xs text-muted-foreground font-normal">
                        ({report.catalogueCurrency})
                      </span>
                    </TableHead>
                  )}
                  <TableHead>
                    Catalogue Price
                    <span className="block text-xs text-muted-foreground font-normal">
                      ({report.catalogueCurrency})
                    </span>
                  </TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.status === "OVERCHARGE"
                        ? "bg-destructive/5"
                        : item.status === "UNDERCHARGE"
                        ? "bg-blue-500/5"
                        : item.status === "UNMATCHED"
                        ? "bg-muted/50"
                        : ""
                    }
                  >
                    <TableCell>
                      <StatusIcon status={item.status} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.receiptItem.productName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.catalogueItem?.productName || "-"}
                    </TableCell>
                    <TableCell>
                      {Number(item.receiptItem.quantity)} {item.receiptItem.unit || ""}
                    </TableCell>
                    <TableCell>
                      {formatPrice(item.receiptPrice, report.receiptCurrency)}
                    </TableCell>
                    {report.receiptCurrency !== report.catalogueCurrency && (
                      <TableCell className="text-muted-foreground">
                        {item.receiptPriceConverted
                          ? formatPrice(item.receiptPriceConverted, report.catalogueCurrency)
                          : "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      {item.cataloguePrice
                        ? formatPrice(item.cataloguePrice, report.catalogueCurrency)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {item.priceDifference !== null ? (
                        <span
                          className={
                            Number(item.priceDifference) > 0
                              ? "text-destructive font-medium"
                              : Number(item.priceDifference) < 0
                              ? "text-blue-500 font-medium"
                              : ""
                          }
                        >
                          {Number(item.priceDifference) > 0 ? "+" : ""}
                          {formatPrice(item.priceDifference, report.catalogueCurrency)}
                          {item.percentageDiff !== null && (
                            <span className="text-xs ml-1">
                              ({Number(item.percentageDiff) > 0 ? "+" : ""}
                              {Number(item.percentageDiff).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={item.matchConfidence} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
