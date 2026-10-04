import { z } from "zod";

// Creators the community recommends to each other. Client-safe: the public
// page, the owner section and the APIs share these schemas and shapes.
export const COMMUNITY_INSPIRATION_STATUSES = ["open", "featured", "rejected"] as const;
export type CommunityInspirationStatus = (typeof COMMUNITY_INSPIRATION_STATUSES)[number];
export type CommunityInspirationPlatform = "youtube" | "twitch" | "kick" | "other";

/** Free suggestions need a limit; a viewer suggests again once one leaves the queue. */
export const MAX_OPEN_INSPIRATIONS_PER_VIEWER = 3;

export const inspirationPlatformLabels: Record<CommunityInspirationPlatform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  other: "Site",
};

export const inspirationLinkLabels: Record<CommunityInspirationPlatform, string> = {
  youtube: "Conhecer no YouTube",
  twitch: "Conhecer na Twitch",
  kick: "Conhecer na Kick",
  other: "Conhecer o canal",
};

const platformHosts: [CommunityInspirationPlatform, string[]][] = [
  ["youtube", ["youtube.com", "m.youtube.com", "youtu.be"]],
  ["twitch", ["twitch.tv", "m.twitch.tv"]],
  ["kick", ["kick.com"]],
];

/**
 * Keeps protocol, host and path; drops credentials, query and fragment. Only
 * http and https links are accepted, since they are shown to everyone.
 */
export function normalizeInspirationLink(raw: string) {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const path = url.pathname.replace(/\/+$/u, "");
  const platform = platformHosts.find(([, hosts]) => hosts.includes(host))?.[0] ?? "other";
  return { url: `https://${host}${path}`, platform };
}

const inspirationFields = {
  name: z.string().trim().min(2, "Digite o nome do criador.").max(120, "Use no máximo 120 caracteres."),
  channelUrl: z.string().trim().min(1, "Cole o link do canal.").max(500, "Link muito longo.")
    .refine((value) => normalizeInspirationLink(value) !== null, "Cole um link válido, começando com http ou https."),
  reason: z.string().trim().max(500, "Use no máximo 500 caracteres.").optional().transform((value) => value || null),
};

export const communityInspirationInputSchema = z.object(inspirationFields).strict();

export const communityInspirationStatusSchema = z
  .object({
    suggestionId: z.string().uuid(),
    status: z.enum(COMMUNITY_INSPIRATION_STATUSES),
  })
  .strict();

export type CommunityInspiration = {
  id: string;
  name: string;
  channelUrl: string;
  platform: CommunityInspirationPlatform;
  reason: string | null;
  status: CommunityInspirationStatus;
  votes: number;
  suggestedBy: string;
  /** Whether the viewer reading the list already voted for it. */
  voted: boolean;
  createdAt: string;
};

export type CommunityInspirationBoard = {
  /** Recommended by the creator. */
  featured: CommunityInspiration[];
  /** Suggested by the audience, most voted first. */
  open: CommunityInspiration[];
  /** Only in the owner's board. */
  rejected: CommunityInspiration[];
};
