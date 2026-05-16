CREATE TABLE "creator_suggestion_boosts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"suggestion_id" varchar(64) NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_suggestions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(255) NOT NULL,
	"channel_url" text NOT NULL,
	"platform" varchar(32) NOT NULL,
	"category" varchar(120),
	"reason" text,
	"status" varchar(32) NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_suggestion_boosts" ADD CONSTRAINT "creator_suggestion_boosts_suggestion_id_creator_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."creator_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_suggestion_boosts" ADD CONSTRAINT "creator_suggestion_boosts_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_suggestions" ADD CONSTRAINT "creator_suggestions_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
