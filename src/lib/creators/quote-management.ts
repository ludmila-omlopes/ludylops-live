import { z } from "zod";

export const quoteBodySchema = z.string().trim().min(1).max(500);
export const ownedQuoteCreateSchema = z.object({ id: z.string().uuid(), body: quoteBodySchema }).strict();
export const ownedQuoteUpdateSchema = z.object({
  id: z.string().uuid(), body: quoteBodySchema,
  // Preserve the exact prior value, including whitespace in older records.
  expectedBody: z.string().min(1).max(10000),
}).strict();
export const quoteCursorSchema = z.number().int().positive().max(2147483647);

export type OwnedQuote = {
  id: string; quoteNumber: number; body: string; createdByDisplayName: string; createdAt: string;
};
export type OwnedQuotePage = { quotes: OwnedQuote[]; nextBefore: number | null };
