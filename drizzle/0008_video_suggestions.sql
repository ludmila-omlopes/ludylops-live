CREATE TABLE "video_suggestion_boosts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"suggestion_id" varchar(64) NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_suggestions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"youtube_video_id" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"creator_name" varchar(255) NOT NULL,
	"thumbnail_url" text NOT NULL,
	"video_url" text NOT NULL,
	"reason" text,
	"status" varchar(32) NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_suggestion_boosts" ADD CONSTRAINT "video_suggestion_boosts_suggestion_id_video_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."video_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_suggestion_boosts" ADD CONSTRAINT "video_suggestion_boosts_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_suggestions" ADD CONSTRAINT "video_suggestions_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;