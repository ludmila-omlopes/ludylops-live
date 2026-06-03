ALTER TABLE "game_suggestions" ADD COLUMN "hltb_id" varchar(32);
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_main_story_minutes" integer;
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_main_extra_minutes" integer;
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_completionist_minutes" integer;
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_similarity" integer;
--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "hltb_fetched_at" timestamp with time zone;
