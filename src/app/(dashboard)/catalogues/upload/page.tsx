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
  name: string;
  language: string;
}

async function uploadCatalogue(data: UploadData) {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("name", data.name);
  formData.append("language", data.language);

  const response = await fetch("/api/catalogues", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export default function UploadCataloguePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("tr");

  const uploadMutation = useMutation({
    mutationFn: uploadCatalogue,
    onSuccess: (data) => {
      toast.success(`Catalogue uploaded successfully! ${data._count?.items || 0} items extracted.`);
      router.push(`/catalogues/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload catalogue");
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
      name: name || file.name.replace(/\.[^/.]+$/, ""),
      language,
    });
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    if (!name) {
      setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/catalogues">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Catalogues
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Catalogue</h1>
        <p className="text-muted-foreground">
          Upload your supplier&apos;s price catalogue for AI extraction
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle>Catalogue Details</CardTitle>
          <CardDescription>
            Upload a file containing your product prices. Our AI will automatically
            extract all items with their prices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload */}
            <div className="space-y-2">
              <Label>File</Label>
              <FileUploader
                onFileSelect={handleFileSelect}
                disabled={uploadMutation.isPending}
                isUploading={uploadMutation.isPending}
              />
            </div>

            {/* Catalogue name */}
            <div className="space-y-2">
              <Label htmlFor="name">Catalogue Name</Label>
              <Input
                id="name"
                placeholder="e.g., Main Supplier Price List 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={uploadMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                Give your catalogue a descriptive name
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
              <p className="text-sm text-muted-foreground">
                Select the language of your document for better extraction accuracy
              </p>
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
                onClick={() => router.push("/catalogues")}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Tips for Best Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Ensure your document is clear and readable</p>
          <p>• PDFs and images with good resolution work best</p>
          <p>• Include product names and prices in a tabular format if possible</p>
          <p>• You can edit extracted items after upload</p>
        </CardContent>
      </Card>
    </div>
  );
}
