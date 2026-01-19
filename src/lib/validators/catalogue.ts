import { z } from "zod";

export const createCatalogueSchema = z.object({
  name: z.string().min(1, "Catalogue name is required"),
  language: z.string().default("tr"),
});

export const updateCatalogueItemSchema = z.object({
  productName: z.string().min(1, "Product name is required").optional(),
  sku: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().positive("Price must be positive"),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createCatalogueItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().positive("Price must be positive"),
  category: z.string().nullable().optional(),
});

export type CreateCatalogueInput = z.infer<typeof createCatalogueSchema>;
export type UpdateCatalogueItemInput = z.infer<typeof updateCatalogueItemSchema>;
export type CreateCatalogueItemInput = z.infer<typeof createCatalogueItemSchema>;
