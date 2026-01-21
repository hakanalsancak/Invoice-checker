import { z } from "zod";

export const createCatalogueSchema = z.object({
  name: z.string().min(1, "Catalogue name is required"),
  currency: z.string().default("GBP"),
});

export const updateCatalogueItemSchema = z.object({
  productName: z.string().min(1, "Product name is required").optional(),
  price: z.number().positive("Price must be positive").optional(),
  category: z.string().nullable().optional(), // Used for description/notes
  isActive: z.boolean().optional(),
});

export const createCatalogueItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  price: z.number().positive("Price must be positive"),
  description: z.string().nullable().optional(), // Will be stored in category field
});

export type CreateCatalogueInput = z.infer<typeof createCatalogueSchema>;
export type UpdateCatalogueItemInput = z.infer<typeof updateCatalogueItemSchema>;
export type CreateCatalogueItemInput = z.infer<typeof createCatalogueItemSchema>;
