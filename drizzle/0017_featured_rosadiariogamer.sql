INSERT INTO "users" (
  "id",
  "google_user_id",
  "email",
  "youtube_channel_id",
  "youtube_display_name",
  "youtube_handle",
  "avatar_url",
  "is_linked",
  "exclude_from_ranking",
  "created_at"
)
VALUES (
  'viewer_ludylops_featured',
  NULL,
  NULL,
  'system:ludylops-featured-creators',
  'Ludylops',
  NULL,
  NULL,
  false,
  true,
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "youtube_display_name" = EXCLUDED."youtube_display_name",
  "exclude_from_ranking" = true;
--> statement-breakpoint
UPDATE "creator_suggestions"
SET
  "viewer_id" = 'viewer_ludylops_featured',
  "slug" = 'rosadiariogamer',
  "name" = 'Rosa Diário Gamer',
  "channel_url" = 'https://www.youtube.com/@rosadiariogamer',
  "platform" = 'youtube',
  "category" = 'games',
  "reason" = 'Canal de games com energia próxima, presença de comunidade e um jeito gostoso de acompanhar gameplay.',
  "status" = 'featured',
  "total_votes" = GREATEST("total_votes", 1210),
  "updated_at" = now()
WHERE "id" = 'cs-featured-rosadiariogamer'
   OR lower("slug") = 'rosadiariogamer'
   OR lower("name") = 'rosa diário gamer'
   OR lower("channel_url") LIKE '%@rosadiariogamer%';
--> statement-breakpoint
INSERT INTO "creator_suggestions" (
  "id",
  "viewer_id",
  "slug",
  "name",
  "channel_url",
  "platform",
  "category",
  "reason",
  "status",
  "total_votes",
  "created_at",
  "updated_at"
)
SELECT
  'cs-featured-rosadiariogamer',
  'viewer_ludylops_featured',
  'rosadiariogamer',
  'Rosa Diário Gamer',
  'https://www.youtube.com/@rosadiariogamer',
  'youtube',
  'games',
  'Canal de games com energia próxima, presença de comunidade e um jeito gostoso de acompanhar gameplay.',
  'featured',
  1210,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM "creator_suggestions"
  WHERE "id" = 'cs-featured-rosadiariogamer'
     OR lower("slug") = 'rosadiariogamer'
     OR lower("name") = 'rosa diário gamer'
     OR lower("channel_url") LIKE '%@rosadiariogamer%'
);
--> statement-breakpoint
UPDATE "creator_suggestions"
SET
  "status" = 'featured',
  "total_votes" = GREATEST("total_votes", 1300),
  "updated_at" = now()
WHERE lower("name") = 'desce a letra'
   OR lower("slug") IN ('desce-a-letra', 'descealetra')
   OR lower("channel_url") LIKE '%desce%letra%';
