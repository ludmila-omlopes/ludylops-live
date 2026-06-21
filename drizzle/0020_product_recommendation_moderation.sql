ALTER TABLE "product_recommendations"
  ADD COLUMN IF NOT EXISTS "moderation_status" varchar(32) DEFAULT 'approved' NOT NULL;

CREATE INDEX IF NOT EXISTS "product_recommendations_moderation_status_idx"
  ON "product_recommendations" USING btree ("moderation_status");
