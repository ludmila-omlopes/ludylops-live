ALTER TABLE "bet_entries" ADD COLUMN "is_house_entry" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "live_like_goals" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(255),
	"target_like_count" integer NOT NULL,
	"reward_amount" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_like_goal_rewards" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"goal_id" varchar(64) NOT NULL,
	"broadcast_id" varchar(128) NOT NULL,
	"like_count" integer NOT NULL,
	"reward_amount" integer NOT NULL,
	"rewarded_viewer_count" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_like_goal_rewards" ADD CONSTRAINT "live_like_goal_rewards_goal_id_live_like_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."live_like_goals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "live_like_goal_rewards_goal_broadcast_idx" ON "live_like_goal_rewards" USING btree ("goal_id","broadcast_id");
