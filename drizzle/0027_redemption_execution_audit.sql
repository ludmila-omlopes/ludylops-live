ALTER TABLE "redemptions" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "redemptions" ADD COLUMN "execution_note" varchar(255);