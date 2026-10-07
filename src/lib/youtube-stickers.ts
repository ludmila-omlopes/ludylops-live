import { z } from "zod";

// Keep the original URL, including animation parameters. Never fetch it on the server.
export function safeYoutubeStickerUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const trusted = host.endsWith(".ggpht.com") || host.endsWith(".googleusercontent.com") ||
      (host === "www.gstatic.com" && url.pathname.startsWith("/youtube/"));
    return url.protocol === "https:" && !url.username && !url.password && !url.port && trusted ? value : null;
  } catch { return null; }
}

export const superStickerSchema = z.object({
  messageId: z.string().trim().min(1).max(256),
  displayName: z.string().trim().max(255).default(""),
  amount: z.string().trim().max(64).default(""),
  stickerId: z.string().trim().max(256).default(""),
  stickerAltText: z.string().trim().max(500).default(""),
  stickerImageUrl: z.string().max(2048).nullable().optional().transform(safeYoutubeStickerUrl),
  publishedAt: z.string().datetime().optional(),
}).strict();

export type SuperStickerInput = z.infer<typeof superStickerSchema>;
export type StickerAlert = {
  id: string;
  receivedAt: string;
  displayName: string;
  amount: string;
  stickerAltText: string;
  stickerImageUrl: string | null;
};
export const STICKER_MAX_AGE_MS = 60 * 60 * 1000;
export const stickerCursorSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[a-f0-9]{0,64}$/)
  .refine(value => Number.isFinite(Date.parse(value.split("|")[0])));
export type StickerBatch = { alerts: StickerAlert[]; cursor: string };
