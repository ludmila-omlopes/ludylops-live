import { env } from "@/lib/env";

type YoutubeChannelSnippet = {
  title?: unknown;
  customUrl?: unknown;
  description?: unknown;
};

type YoutubeChannelsResponse = {
  items?: Array<{
    id?: unknown;
    snippet?: YoutubeChannelSnippet;
  }>;
};

type YoutubeChannelReference =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

export type YoutubeChannelMetadata = {
  name: string;
  channelUrl: string;
  description: string | null;
};

export function extractYoutubeChannelReference(rawUrl: string): YoutubeChannelReference | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "m.youtube.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (!first) {
    return null;
  }

  if (first.startsWith("@") && parts.length === 1 && first.length > 1) {
    return { kind: "handle", value: first.slice(1) };
  }

  if (parts.length !== 2 || !second) {
    return null;
  }

  if (first === "channel" && /^UC[\w-]{20,}$/u.test(second)) {
    return { kind: "id", value: second };
  }

  if (first === "user" && /^[\w.-]+$/u.test(second)) {
    return { kind: "username", value: second };
  }

  return null;
}

export async function resolveYoutubeChannelMetadata(rawUrl: string): Promise<YoutubeChannelMetadata> {
  const reference = extractYoutubeChannelReference(rawUrl);
  if (!reference) {
    throw new Error("invalid_youtube_channel_url");
  }

  if (!env.YOUTUBE_API_KEY) {
    throw new Error("youtube_api_not_configured");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("key", env.YOUTUBE_API_KEY);
  if (reference.kind === "id") {
    url.searchParams.set("id", reference.value);
  } else if (reference.kind === "handle") {
    url.searchParams.set("forHandle", reference.value);
  } else {
    url.searchParams.set("forUsername", reference.value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("youtube_channel_not_found");
  }

  const payload = (await response.json()) as YoutubeChannelsResponse;
  const channel = payload.items?.[0];
  const name = typeof channel?.snippet?.title === "string" ? channel.snippet.title.trim() : "";
  const description =
    typeof channel?.snippet?.description === "string" ? channel.snippet.description.trim() : "";
  const channelId = typeof channel?.id === "string" ? channel.id.trim() : "";
  const customUrl = typeof channel?.snippet?.customUrl === "string" ? channel.snippet.customUrl.trim() : "";

  if (!name || !channelId) {
    throw new Error("youtube_channel_not_found");
  }

  const normalizedCustomUrl = customUrl
    ? customUrl.startsWith("@")
      ? customUrl
      : `@${customUrl}`
    : null;

  return {
    name,
    channelUrl: normalizedCustomUrl
      ? `https://www.youtube.com/${normalizedCustomUrl}`
      : `https://www.youtube.com/channel/${channelId}`,
    description: description || null,
  };
}
