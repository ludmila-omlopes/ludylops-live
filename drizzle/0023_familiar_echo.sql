ALTER TABLE "bet_entries" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "bet_options" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "bridge_clients" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_suggestion_boosts" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_suggestions" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_suggestion_boosts" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "live_like_goal_rewards" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "live_like_goals" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_recommendations" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "redemptions" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "streamerbot_event_log" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_suggestion_boosts" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_suggestions" ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL;--> statement-breakpoint
ALTER TABLE "bet_entries" ADD CONSTRAINT "bet_entries_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_options" ADD CONSTRAINT "bet_options_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_clients" ADD CONSTRAINT "bridge_clients_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_suggestion_boosts" ADD CONSTRAINT "creator_suggestion_boosts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_suggestions" ADD CONSTRAINT "creator_suggestions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_suggestion_boosts" ADD CONSTRAINT "game_suggestion_boosts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_suggestions" ADD CONSTRAINT "game_suggestions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_like_goal_rewards" ADD CONSTRAINT "live_like_goal_rewards_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_like_goals" ADD CONSTRAINT "live_like_goals_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streamerbot_event_log" ADD CONSTRAINT "streamerbot_event_log_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_suggestion_boosts" ADD CONSTRAINT "video_suggestion_boosts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_suggestions" ADD CONSTRAINT "video_suggestions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_entries_creator_id_idx" ON "bet_entries" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "bet_options_creator_id_idx" ON "bet_options" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "bets_creator_id_idx" ON "bets" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "bridge_clients_creator_id_idx" ON "bridge_clients" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_suggestion_boosts_creator_id_idx" ON "creator_suggestion_boosts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_suggestions_creator_id_idx" ON "creator_suggestions" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "game_suggestion_boosts_creator_id_idx" ON "game_suggestion_boosts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "game_suggestions_creator_id_idx" ON "game_suggestions" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "live_like_goal_rewards_creator_id_idx" ON "live_like_goal_rewards" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "live_like_goals_creator_id_idx" ON "live_like_goals" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "point_ledger_creator_id_idx" ON "point_ledger" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "product_recommendations_creator_id_idx" ON "product_recommendations" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "redemptions_creator_id_idx" ON "redemptions" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "streamerbot_event_log_creator_id_idx" ON "streamerbot_event_log" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "video_suggestion_boosts_creator_id_idx" ON "video_suggestion_boosts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "video_suggestions_creator_id_idx" ON "video_suggestions" USING btree ("creator_id");