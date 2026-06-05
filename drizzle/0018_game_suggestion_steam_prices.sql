ALTER TABLE "game_suggestions" ADD COLUMN "steam_app_id" integer;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_name" varchar(255);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_store_url" text;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_currency" varchar(8);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_initial_price" integer;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_final_price" integer;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_discount_percent" integer;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_is_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_match_confidence" varchar(32);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "steam_last_price_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "game_suggestions_steam_app_id_idx" ON "game_suggestions" USING btree ("steam_app_id");
