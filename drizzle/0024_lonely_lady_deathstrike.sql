CREATE TABLE "streamerbot_credentials" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"encrypted_secret" text NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retiring_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "streamerbot_credentials" ADD CONSTRAINT "streamerbot_credentials_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "streamerbot_credentials_creator_id_idx" ON "streamerbot_credentials" USING btree ("creator_id");