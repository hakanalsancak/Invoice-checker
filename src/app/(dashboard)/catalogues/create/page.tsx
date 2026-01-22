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
  name: string;
  currency: string;
}

async function createCatalogue(data: CreateData) {
  const response = await fetch("/api/catalogues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export default function CreateCataloguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");

  const createMutation = useMutation({
    mutationFn: createCatalogue,
    onSuccess: (data) => {
      toast.success("Catalogue created! Now add your products.");
      router.push(`/catalogues/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create catalogue");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter a catalogue name");
      return;
    }

    createMutation.mutate({ name: name.trim(), currency });
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
        <h1 className="text-3xl font-bold tracking-tight">Create Catalogue</h1>
        <p className="text-muted-foreground">
          Create a new price catalogue to store your supplier&apos;s products and prices
        </p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>Catalogue Details</CardTitle>
          <CardDescription>
            Enter the basic details for your catalogue. You&apos;ll be able to add products after creating it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Catalogue name */}
            <div className="space-y-2">
              <Label htmlFor="name">Catalogue Name *</Label>
              <Input
                id="name"
                placeholder="Enter catalogue name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createMutation.isPending}
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                Give your catalogue a descriptive name (e.g., supplier name + year)
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
                Select the currency for prices in this catalogue
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={!name.trim() || createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Catalogue"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/catalogues")}
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
          <CardTitle className="text-lg">Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create the catalogue with a name and currency</p>
          <p>2. Add products manually with their names and prices</p>
          <p>3. Use this catalogue to verify invoice prices</p>
        </CardContent>
      </Card>
    </div>
  );
}
