CREATE TABLE "obs_overlay_control" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	"last_error" text
);

CREATE TABLE "quote_overlay_queue" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"quote_number" integer NOT NULL,
	"quote_body" text NOT NULL,
	"created_by_display_name" varchar(255) NOT NULL,
	"created_by_youtube_handle" varchar(255),
	"requested_by_viewer_id" varchar(64) NOT NULL,
	"requested_by_display_name" varchar(255) NOT NULL,
	"requested_by_youtube_handle" varchar(255),
	"source" varchar(64) DEFAULT 'streamerbot_chat' NOT NULL,
	"cost" integer NOT NULL,
	"display_duration_seconds" integer NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"failure_reason" text
);

ALTER TABLE "quote_overlay_queue" ADD CONSTRAINT "quote_overlay_queue_requested_by_viewer_id_users_id_fk" FOREIGN KEY ("requested_by_viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
