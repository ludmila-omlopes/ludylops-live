CREATE TABLE "creator_catalog_items" (
	"creator_id" varchar(64) NOT NULL,
	"id" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(1000) NOT NULL,
	"cost" integer NOT NULL,
	"stock" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"global_cooldown_seconds" integer DEFAULT 0 NOT NULL,
	"viewer_cooldown_seconds" integer DEFAULT 0 NOT NULL,
	"streamerbot_action_ref" varchar(255) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "creator_catalog_items_creator_id_id_pk" PRIMARY KEY("creator_id","id"),
	CONSTRAINT "creator_catalog_nonlegacy" CHECK ("creator_catalog_items"."creator_id" <> 'creator_ludylops'),
	CONSTRAINT "creator_catalog_values" CHECK ("creator_catalog_items"."cost" > 0 AND ("creator_catalog_items"."stock" IS NULL OR "creator_catalog_items"."stock" >= 0) AND "creator_catalog_items"."global_cooldown_seconds" >= 0 AND "creator_catalog_items"."viewer_cooldown_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "creator_redemptions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"catalog_item_id" varchar(64) NOT NULL,
	"item_name" varchar(120) NOT NULL,
	"action_ref" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"cost_at_purchase" integer NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"debit_id" varchar(64) NOT NULL,
	"bridge_attempt_count" integer DEFAULT 0 NOT NULL,
	"claimed_by_bridge_id" varchar(64),
	"claimed_at" timestamp with time zone,
	"execution_note" varchar(255),
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" varchar(255),
	CONSTRAINT "creator_redemptions_nonlegacy" CHECK ("creator_redemptions"."creator_id" <> 'creator_ludylops')
);
--> statement-breakpoint
ALTER TABLE "creator_catalog_items" ADD CONSTRAINT "creator_catalog_items_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_redemptions" ADD CONSTRAINT "creator_redemptions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_redemptions" ADD CONSTRAINT "creator_redemptions_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_redemptions" ADD CONSTRAINT "creator_redemptions_debit_id_creator_ledger_id_fk" FOREIGN KEY ("debit_id") REFERENCES "public"."creator_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_redemptions_event_idx" ON "creator_redemptions" USING btree ("creator_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "creator_redemptions_queue_idx" ON "creator_redemptions" USING btree ("creator_id","status","queued_at");--> statement-breakpoint
CREATE INDEX "creator_redemptions_history_idx" ON "creator_redemptions" USING btree ("creator_id","viewer_id","queued_at");--> statement-breakpoint
CREATE INDEX "creator_redemptions_item_idx" ON "creator_redemptions" USING btree ("creator_id","catalog_item_id","queued_at");