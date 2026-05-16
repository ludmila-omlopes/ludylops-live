DELETE FROM "creator_suggestion_boosts"
WHERE "suggestion_id" IN (
  SELECT "id"
  FROM "creator_suggestions"
  WHERE lower("name") IN ('nerdologia', 'jogabilidade', 'alanzoka')
     OR "slug" IN ('nerdologia', 'jogabilidade', 'alanzoka')
);
--> statement-breakpoint
DELETE FROM "creator_suggestions"
WHERE lower("name") IN ('nerdologia', 'jogabilidade', 'alanzoka')
   OR "slug" IN ('nerdologia', 'jogabilidade', 'alanzoka');
--> statement-breakpoint
UPDATE "creator_suggestions"
SET
  "status" = 'featured',
  "updated_at" = now()
WHERE "status" <> 'featured';
