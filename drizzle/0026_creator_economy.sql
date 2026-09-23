CREATE TABLE "creator_balances" (
	"creator_id" varchar(64) NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"current_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_balances_creator_id_viewer_id_pk" PRIMARY KEY("creator_id","viewer_id"),
	CONSTRAINT "creator_balances_nonnegative" CHECK ("creator_balances"."current_balance" >= 0 AND "creator_balances"."lifetime_earned" >= 0 AND "creator_balances"."lifetime_spent" >= 0),
	CONSTRAINT "creator_balances_nonlegacy" CHECK ("creator_balances"."creator_id" <> 'creator_ludylops')
);
--> statement-breakpoint
CREATE TABLE "creator_ledger" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"viewer_id" varchar(64) NOT NULL,
	"operation_key" varchar(128) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(160) NOT NULL,
	"refund_of" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_ledger_nonlegacy" CHECK ("creator_ledger"."creator_id" <> 'creator_ludylops')
);
--> statement-breakpoint
CREATE TABLE "economy_viewer_redirects" (
	"source_viewer_id" varchar(64) PRIMARY KEY NOT NULL,
	"target_viewer_id" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_balances" ADD CONSTRAINT "creator_balances_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_balances" ADD CONSTRAINT "creator_balances_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_ledger" ADD CONSTRAINT "creator_ledger_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_ledger" ADD CONSTRAINT "creator_ledger_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy_viewer_redirects" ADD CONSTRAINT "economy_viewer_redirects_target_viewer_id_users_id_fk" FOREIGN KEY ("target_viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creator_balances_viewer_idx" ON "creator_balances" USING btree ("viewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_ledger_operation_idx" ON "creator_ledger" USING btree ("creator_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_ledger_refund_idx" ON "creator_ledger" USING btree ("creator_id","refund_of");--> statement-breakpoint
CREATE INDEX "creator_ledger_history_idx" ON "creator_ledger" USING btree ("creator_id","viewer_id","created_at");