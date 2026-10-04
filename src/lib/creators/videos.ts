import { z } from "zod";

// Community videos to react to. Client-safe: the public page, the owner section
// and the APIs share these schemas and shapes.
export const COMMUNITY_VIDEO_STATUSES = ["open", "reacted", "rejected"] as const;
export type CommunityVideoStatus = (typeof COMMUNITY_VIDEO_STATUSES)[number];

/** Free suggestions need a limit; a viewer suggests again once one leaves the queue. */
export const MAX_OPEN_VIDEOS_PER_VIEWER = 3;

export const communityVideoInputSchema = z
  .object({
    videoUrl: z.string().trim().min(1, "Cole o link do vídeo no YouTube.").max(500, "Link muito longo."),
    reason: z
      .string()
      .trim()
      .max(500, "Use no máximo 500 caracteres.")
      .optional()
      .transform((value) => value || null),
  })
  .strict();

export const communityVideoStatusSchema = z
  .object({
    suggestionId: z.string().uuid(),
    status: z.enum(COMMUNITY_VIDEO_STATUSES),
  })
  .strict();

export type CommunityVideo = {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  videoUrl: string;
  reason: string | null;
  status: CommunityVideoStatus;
  votes: number;
  suggestedBy: string;
  /** Whether the viewer reading the list already voted for it. */
  voted: boolean;
  createdAt: string;
};

export type CommunityVideoBoard = {
  /** Most voted first. */
  open: CommunityVideo[];
  /** Most recent reactions first. */
  reacted: CommunityVideo[];
  /** Only in the owner's board. */
  rejected: CommunityVideo[];
};

export const youtubeThumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
