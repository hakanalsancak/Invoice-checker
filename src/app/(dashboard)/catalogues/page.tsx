"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, FileText, MoreHorizontal, Trash2, Eye, Loader2, Upload } from "lucide-react";
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

interface Catalogue {
  id: string;
  name: string;
  originalFileName: string;
  language: string;
  status: string;
  createdAt: string;
  _count: {
    items: number;
  };
}

async function fetchCatalogues(): Promise<Catalogue[]> {
  const response = await fetch("/api/catalogues");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function deleteCatalogue(id: string): Promise<void> {
  const response = await fetch(`/api/catalogues/${id}`, {
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

export default function CataloguesPage() {
  const queryClient = useQueryClient();

  const { data: catalogues, isLoading, error } = useQuery({
    queryKey: ["catalogues"],
    queryFn: fetchCatalogues,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCatalogue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogues"] });
      toast.success("Catalogue deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete catalogue");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catalogues</h1>
            <p className="text-muted-foreground">Manage your price catalogues</p>
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
        <p className="text-muted-foreground">Failed to load catalogues</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogues</h1>
          <p className="text-muted-foreground">
            Manage your supplier price catalogues
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/catalogues/upload">
              <Upload className="mr-2 h-4 w-4" />
              Import from File
            </Link>
          </Button>
          <Button asChild>
            <Link href="/catalogues/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Catalogue
            </Link>
          </Button>
        </div>
      </div>

      {/* Catalogues list */}
      {catalogues && catalogues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No catalogues yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first price catalogue to get started
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/catalogues/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Import from File
                </Link>
              </Button>
              <Button asChild>
                <Link href="/catalogues/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Catalogue
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalogues?.map((catalogue) => (
            <Card key={catalogue.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg line-clamp-1">
                      {catalogue.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {catalogue.originalFileName}
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
                        <Link href={`/catalogues/${catalogue.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
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
                            <AlertDialogTitle>Delete Catalogue</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this catalogue? This
                              action cannot be undone and will also delete all
                              associated items.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(catalogue.id)}
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
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={catalogue.status} />
                      <Badge variant="outline">{catalogue.language.toUpperCase()}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {catalogue._count.items} items
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(catalogue.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="mt-4">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/catalogues/${catalogue.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
