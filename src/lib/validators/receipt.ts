import { z } from "zod";

export const createReceiptSchema = z.object({
  supplierName: z.string().optional(),
  receiptDate: z.string().optional(),
  language: z.string().default("tr"),
});

export const verifyReceiptSchema = z.object({
  catalogueId: z.string().min(1, "Please select a catalogue to compare against"),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type VerifyReceiptInput = z.infer<typeof verifyReceiptSchema>;
