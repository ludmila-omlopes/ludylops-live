CREATE TABLE "creator_bridge_status" (
	"creator_id" varchar(64) NOT NULL,
	"bridge_id" varchar(64) NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_bridge_status_creator_id_bridge_id_pk" PRIMARY KEY("creator_id","bridge_id"),
	CONSTRAINT "creator_bridge_status_nonlegacy" CHECK ("creator_bridge_status"."creator_id" <> 'creator_ludylops')
);
--> statement-breakpoint
CREATE TABLE "creator_redemption_resolutions" (
	"redemption_id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"owner_viewer_id" varchar(64) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"note" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_resolutions_nonlegacy" CHECK ("creator_redemption_resolutions"."creator_id" <> 'creator_ludylops'),
	CONSTRAINT "creator_resolutions_outcome" CHECK ("creator_redemption_resolutions"."outcome" in ('completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "creator_bridge_status" ADD CONSTRAINT "creator_bridge_status_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_redemption_resolutions" ADD CONSTRAINT "creator_redemption_resolutions_redemption_id_creator_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."creator_redemptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_redemption_resolutions" ADD CONSTRAINT "creator_redemption_resolutions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creator_resolutions_creator_idx" ON "creator_redemption_resolutions" USING btree ("creator_id","created_at");