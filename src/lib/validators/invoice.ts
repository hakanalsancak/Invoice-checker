import { z } from "zod";

export const createInvoiceSchema = z.object({
  supplierName: z.string().nullish().transform(val => val || undefined),
  invoiceDate: z.string().nullish().transform(val => val || undefined),
  language: z.string().nullish().transform(val => val || "tr"),
});

export const verifyInvoiceSchema = z.object({
  catalogueId: z.string().min(1, "Please select a catalogue to compare against"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type VerifyInvoiceInput = z.infer<typeof verifyInvoiceSchema>;
