ALTER TABLE "game_suggestions" ADD COLUMN "igdb_id" integer;
ALTER TABLE "game_suggestions" ADD COLUMN "canonical_name" varchar(255);
ALTER TABLE "game_suggestions" ADD COLUMN "cover_image_url" text;
ALTER TABLE "game_suggestions" ADD COLUMN "release_year" integer;
ALTER TABLE "game_suggestions" ADD COLUMN "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_suggestions" ADD COLUMN "genres" jsonb DEFAULT '[]'::jsonb NOT NULL;
