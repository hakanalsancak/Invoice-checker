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
import { FileUploader } from "@/components/shared/FileUploader";

interface UploadData {
  file: File;
  supplierName?: string;
  receiptDate?: string;
  language: string;
}

async function uploadReceipt(data: UploadData) {
  const formData = new FormData();
  formData.append("file", data.file);
  if (data.supplierName) formData.append("supplierName", data.supplierName);
  if (data.receiptDate) formData.append("receiptDate", data.receiptDate);
  formData.append("language", data.language);

  const response = await fetch("/api/receipts", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export default function UploadReceiptPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [language, setLanguage] = useState("tr");

  const uploadMutation = useMutation({
    mutationFn: uploadReceipt,
    onSuccess: (data) => {
      toast.success(`Receipt uploaded successfully! ${data._count?.items || 0} items extracted.`);
      router.push(`/receipts/${data.id}?verify=true`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload receipt");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    uploadMutation.mutate({
      file,
      supplierName: supplierName || undefined,
      receiptDate: receiptDate || undefined,
      language,
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
        <h1 className="text-3xl font-bold tracking-tight">Upload Receipt</h1>
        <p className="text-muted-foreground">
          Upload a receipt or invoice for AI extraction and price verification
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
          <CardDescription>
            Upload your receipt or invoice. Our AI will automatically extract all
            line items for price comparison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload */}
            <div className="space-y-2">
              <Label>File</Label>
              <FileUploader
                onFileSelect={(f) => setFile(f)}
                disabled={uploadMutation.isPending}
                isUploading={uploadMutation.isPending}
              />
            </div>

            {/* Supplier name */}
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name (Optional)</Label>
              <Input
                id="supplierName"
                placeholder="e.g., ABC Wholesale Ltd."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={uploadMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                AI will try to detect this automatically if not provided
              </p>
            </div>

            {/* Receipt date */}
            <div className="space-y-2">
              <Label htmlFor="receiptDate">Receipt Date (Optional)</Label>
              <Input
                id="receiptDate"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                disabled={uploadMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                AI will try to detect this automatically if not provided
              </p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Document Language</Label>
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={uploadMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tr">Turkish (Türkçe)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">German (Deutsch)</SelectItem>
                  <SelectItem value="fr">French (Français)</SelectItem>
                  <SelectItem value="es">Spanish (Español)</SelectItem>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={!file || uploadMutation.isPending}
                className="flex-1"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Upload & Extract"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/receipts")}
                disabled={uploadMutation.isPending}
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
          <CardTitle className="text-lg">What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. AI extracts all line items from your receipt</p>
          <p>2. You review the extracted items</p>
          <p>3. Select a price catalogue to compare against</p>
          <p>4. Get instant price verification report</p>
        </CardContent>
      </Card>
    </div>
  );
}
