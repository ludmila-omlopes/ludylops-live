CREATE TABLE "creators" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"owner_user_id" varchar(64),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_domains" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_branding" (
	"creator_id" varchar(64) PRIMARY KEY NOT NULL,
	"logo_url" text,
	"avatar_url" text,
	"primary_color" varchar(16) DEFAULT '#c7a2e9' NOT NULL,
	"secondary_color" varchar(16) DEFAULT '#ff79c6' NOT NULL,
	"background_color" varchar(16) DEFAULT '#f9f9f9' NOT NULL,
	"accent_color" varchar(16) DEFAULT '#40a9ff' NOT NULL,
	"font_heading" varchar(120) DEFAULT 'app-display' NOT NULL,
	"font_body" varchar(120) DEFAULT 'app-body' NOT NULL,
	"border_radius" integer DEFAULT 0 NOT NULL,
	"theme_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_modules" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_id" varchar(64) NOT NULL,
	"module_key" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'installed' NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creator_domains" ADD CONSTRAINT "creator_domains_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creator_branding" ADD CONSTRAINT "creator_branding_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creator_modules" ADD CONSTRAINT "creator_modules_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "creators_slug_idx" ON "creators" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "creators_owner_user_id_idx" ON "creators" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_domains_hostname_idx" ON "creator_domains" USING btree ("hostname");
--> statement-breakpoint
CREATE INDEX "creator_domains_creator_id_idx" ON "creator_domains" USING btree ("creator_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_modules_creator_module_idx" ON "creator_modules" USING btree ("creator_id","module_key");
--> statement-breakpoint
CREATE INDEX "creator_modules_creator_id_idx" ON "creator_modules" USING btree ("creator_id");
--> statement-breakpoint
INSERT INTO "creators" ("id", "slug", "display_name", "owner_user_id", "status")
VALUES ('creator_ludylops', 'ludylops', 'Ludylops', NULL, 'active')
ON CONFLICT ("id") DO UPDATE SET
	"slug" = EXCLUDED."slug",
	"display_name" = EXCLUDED."display_name",
	"status" = EXCLUDED."status",
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "creator_domains" ("id", "creator_id", "hostname", "is_primary")
VALUES ('creator_domain_ludylops_live', 'creator_ludylops', 'ludylops.live', true)
ON CONFLICT ("id") DO UPDATE SET
	"creator_id" = EXCLUDED."creator_id",
	"hostname" = EXCLUDED."hostname",
	"is_primary" = EXCLUDED."is_primary";
--> statement-breakpoint
INSERT INTO "creator_branding" (
	"creator_id",
	"primary_color",
	"secondary_color",
	"background_color",
	"accent_color",
	"font_heading",
	"font_body",
	"border_radius",
	"theme_json"
)
VALUES (
	'creator_ludylops',
	'#c7a2e9',
	'#ff79c6',
	'#f9f9f9',
	'#40a9ff',
	'app-display',
	'app-body',
	0,
	'{}'::jsonb
)
ON CONFLICT ("creator_id") DO UPDATE SET
	"primary_color" = EXCLUDED."primary_color",
	"secondary_color" = EXCLUDED."secondary_color",
	"background_color" = EXCLUDED."background_color",
	"accent_color" = EXCLUDED."accent_color",
	"font_heading" = EXCLUDED."font_heading",
	"font_body" = EXCLUDED."font_body",
	"border_radius" = EXCLUDED."border_radius",
	"theme_json" = EXCLUDED."theme_json",
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "creator_modules" ("id", "creator_id", "module_key", "status", "config_json")
VALUES
	('creator_module_ludylops_points', 'creator_ludylops', 'points', 'installed', '{"currencyLabel":"pipetz"}'::jsonb),
	('creator_module_ludylops_ranking', 'creator_ludylops', 'ranking', 'installed', '{}'::jsonb),
	('creator_module_ludylops_redemptions', 'creator_ludylops', 'redemptions', 'installed', '{}'::jsonb),
	('creator_module_ludylops_bets', 'creator_ludylops', 'bets', 'installed', '{"minBet":10,"maxOptions":6}'::jsonb),
	('creator_module_ludylops_product_recommendations', 'creator_ludylops', 'product_recommendations', 'installed', '{}'::jsonb),
	('creator_module_ludylops_game_suggestions', 'creator_ludylops', 'game_suggestions', 'installed', '{}'::jsonb),
	('creator_module_ludylops_video_suggestions', 'creator_ludylops', 'video_suggestions', 'installed', '{}'::jsonb),
	('creator_module_ludylops_creator_suggestions', 'creator_ludylops', 'creator_suggestions', 'installed', '{}'::jsonb),
	('creator_module_ludylops_quotes', 'creator_ludylops', 'quotes', 'installed', '{"displayDurationSeconds":12}'::jsonb),
	('creator_module_ludylops_obs_overlays', 'creator_ludylops', 'obs_overlays', 'installed', '{}'::jsonb),
	('creator_module_ludylops_streamerbot', 'creator_ludylops', 'streamerbot', 'installed', '{}'::jsonb)
ON CONFLICT ("creator_id", "module_key") DO UPDATE SET
	"status" = EXCLUDED."status",
	"config_json" = EXCLUDED."config_json",
	"updated_at" = now();
