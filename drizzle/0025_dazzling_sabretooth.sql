-- Reviewed correction for Drizzle Kit 0.31.10: add columns before composite keys.
-- Prior inline primary keys use PostgreSQL defaults, verified on the baseline fixture.
ALTER TABLE "obs_overlay_control" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_overlay_queue" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_overlay_state" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
DROP INDEX "quotes_quote_number_idx";--> statement-breakpoint
ALTER TABLE "obs_overlay_control" DROP CONSTRAINT "obs_overlay_control_pkey";--> statement-breakpoint
ALTER TABLE "quote_overlay_state" DROP CONSTRAINT "quote_overlay_state_pkey";--> statement-breakpoint
ALTER TABLE "obs_overlay_control" ADD CONSTRAINT "obs_overlay_control_creator_id_key_pk" PRIMARY KEY("creator_id","key");--> statement-breakpoint
ALTER TABLE "quote_overlay_state" ADD CONSTRAINT "quote_overlay_state_creator_id_slot_pk" PRIMARY KEY("creator_id","slot");--> statement-breakpoint
ALTER TABLE "obs_overlay_control" ADD CONSTRAINT "obs_overlay_control_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_overlay_queue" ADD CONSTRAINT "quote_overlay_queue_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_overlay_state" ADD CONSTRAINT "quote_overlay_state_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_overlay_queue_creator_id_idx" ON "quote_overlay_queue" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_creator_quote_number_idx" ON "quotes" USING btree ("creator_id","quote_number");
