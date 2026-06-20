CREATE INDEX IF NOT EXISTS "point_ledger_viewer_created_idx" ON "point_ledger" USING btree ("viewer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bet_entries_viewer_id_idx" ON "bet_entries" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_suggestion_boosts_suggestion_id_idx" ON "game_suggestion_boosts" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_suggestion_boosts_viewer_id_idx" ON "game_suggestion_boosts" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_suggestion_boosts_suggestion_id_idx" ON "video_suggestion_boosts" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_suggestion_boosts_viewer_id_idx" ON "video_suggestion_boosts" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_suggestion_boosts_suggestion_id_idx" ON "creator_suggestion_boosts" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_suggestion_boosts_viewer_id_idx" ON "creator_suggestion_boosts" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redemptions_viewer_id_idx" ON "redemptions" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redemptions_status_queued_at_idx" ON "redemptions" USING btree ("status","queued_at");
