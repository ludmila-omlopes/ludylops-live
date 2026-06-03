ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_region" varchar(16);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_tier" varchar(32);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_product_id" varchar(128);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_title_id" varchar(64);--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_product_url" text;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "ps_plus_last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "ps_plus_catalog_items" (
  "id" varchar(160) PRIMARY KEY NOT NULL,
  "region" varchar(16) NOT NULL,
  "tier" varchar(32) NOT NULL,
  "product_id" varchar(128) NOT NULL,
  "title_id" varchar(64),
  "name" varchar(255) NOT NULL,
  "normalized_name" varchar(255) NOT NULL,
  "product_url" text NOT NULL,
  "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ps_plus_catalog_sync_state" (
  "region" varchar(16) PRIMARY KEY NOT NULL,
  "tier" varchar(32) NOT NULL,
  "status" varchar(32) NOT NULL,
  "item_count" integer DEFAULT 0 NOT NULL,
  "synced_at" timestamp with time zone,
  "next_sync_at" timestamp with time zone,
  "last_error" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "ps_plus_catalog_items_region_product_idx" ON "ps_plus_catalog_items" USING btree ("region","product_id");--> statement-breakpoint
CREATE INDEX "ps_plus_catalog_items_region_normalized_name_idx" ON "ps_plus_catalog_items" USING btree ("region","normalized_name");
