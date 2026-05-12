import { z } from "zod";

export const videoSuggestionStatusSchema = z.enum(["open", "accepted", "reacted", "rejected"]);

export const createVideoSuggestionSchema = z.object({
  videoUrl: z.string().trim().min(1, "Cole o link do YouTube.").max(500, "Link muito longo."),
  reason: z
    .string()
    .trim()
    .max(500, "Use no maximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const boostVideoSuggestionSchema = z.object({
  amount: z.number().int().positive("Digite um valor inteiro positivo."),
});

export const updateVideoSuggestionStatusSchema = z.object({
  status: videoSuggestionStatusSchema,
});

export type YoutubeVideoMetadata = {
  videoId: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string;
  videoUrl: string;
};

type YoutubeOembedResponse = {
  title?: unknown;
  author_name?: unknown;
  thumbnail_url?: unknown;
};

export function extractYoutubeVideoId(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    return normalizeVideoId(url.pathname.split("/").filter(Boolean)[0] ?? "");
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      return normalizeVideoId(url.searchParams.get("v") ?? "");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "live", "embed", "v"].includes(parts[0] ?? "")) {
      return normalizeVideoId(parts[1] ?? "");
    }
  }

  return null;
}

export function buildYoutubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function validateVideoSuggestionDraft(input: {
  videoUrl: string;
  reason?: string | null;
}) {
  const parsed = createVideoSuggestionSchema.safeParse({
    videoUrl: input.videoUrl,
    reason: input.reason ?? undefined,
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Sugestao invalida.";
  }

  if (!extractYoutubeVideoId(parsed.data.videoUrl)) {
    return "Cole um link valido de video do YouTube.";
  }

  return null;
}

export function validateVideoSuggestionBoostAmount(amount: number) {
  const parsed = boostVideoSuggestionSchema.safeParse({ amount });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Valor invalido.";
  }
  return null;
}

export async function resolveYoutubeVideoMetadata(rawUrl: string): Promise<YoutubeVideoMetadata> {
  const videoId = extractYoutubeVideoId(rawUrl);
  if (!videoId) {
    throw new Error("invalid_youtube_url");
  }

  const videoUrl = buildYoutubeWatchUrl(videoId);
  const response = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`,
    {
      headers: {
        accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("youtube_video_not_found");
  }

  const payload = (await response.json()) as YoutubeOembedResponse;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const creatorName = typeof payload.author_name === "string" ? payload.author_name.trim() : "";
  const thumbnailUrl = typeof payload.thumbnail_url === "string" ? payload.thumbnail_url.trim() : "";

  if (!title || !creatorName || !thumbnailUrl) {
    throw new Error("youtube_video_not_found");
  }

  return {
    videoId,
    title,
    creatorName,
    thumbnailUrl,
    videoUrl,
  };
}

export function formatVideoSuggestionSchemaError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Payload invalido.";
}

function normalizeVideoId(value: string) {
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(trimmed) ? trimmed : null;
}
