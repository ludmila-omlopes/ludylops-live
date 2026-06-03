import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    googleUserId: varchar("google_user_id", { length: 128 }),
    email: varchar("email", { length: 255 }),
    youtubeChannelId: varchar("youtube_channel_id", { length: 128 }).notNull(),
    youtubeDisplayName: varchar("youtube_display_name", { length: 255 }).notNull(),
    youtubeHandle: varchar("youtube_handle", { length: 255 }),
    avatarUrl: text("avatar_url"),
    isLinked: boolean("is_linked").default(false).notNull(),
    excludeFromRanking: boolean("exclude_from_ranking").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    youtubeChannelIdIdx: uniqueIndex("users_youtube_channel_id_idx").on(table.youtubeChannelId),
  }),
);

export const googleAccounts = pgTable(
  "google_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    googleUserId: varchar("google_user_id", { length: 128 }),
    email: varchar("email", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    activeViewerId: varchar("active_viewer_id", { length: 64 }).references(() => users.id),
    crossAccountProtectionState: varchar("cross_account_protection_state", { length: 32 })
      .default("ok")
      .notNull(),
    crossAccountProtectionEvent: varchar("cross_account_protection_event", { length: 255 }),
    crossAccountProtectionReason: varchar("cross_account_protection_reason", { length: 255 }),
    crossAccountProtectionUpdatedAt: timestamp("cross_account_protection_updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sessionsRevokedAt: timestamp("sessions_revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    googleUserIdIdx: uniqueIndex("google_accounts_google_user_id_idx").on(table.googleUserId),
    emailIdx: uniqueIndex("google_accounts_email_idx").on(table.email),
  }),
);

export const googleAccountViewers = pgTable(
  "google_account_viewers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    googleAccountId: varchar("google_account_id", { length: 64 })
      .references(() => googleAccounts.id)
      .notNull(),
    viewerId: varchar("viewer_id", { length: 64 })
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    googleAccountViewerIdx: uniqueIndex("google_account_viewers_account_viewer_idx").on(
      table.googleAccountId,
      table.viewerId,
    ),
    viewerIdIdx: uniqueIndex("google_account_viewers_viewer_id_idx").on(table.viewerId),
  }),
);

export const viewerBalances = pgTable("viewer_balances", {
  viewerId: varchar("viewer_id", { length: 64 })
    .primaryKey()
    .references(() => users.id),
  currentBalance: integer("current_balance").default(0).notNull(),
  lifetimeEarned: integer("lifetime_earned").default(0).notNull(),
  lifetimeSpent: integer("lifetime_spent").default(0).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export const viewerLinks = pgTable(
  "viewer_links",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    googleAccountId: varchar("google_account_id", { length: 64 })
      .references(() => googleAccounts.id)
      .notNull(),
    linkCode: varchar("link_code", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => ({
    googleAccountIdIdx: uniqueIndex("viewer_links_google_account_id_idx").on(table.googleAccountId),
    codeIdx: uniqueIndex("viewer_links_code_idx").on(table.linkCode),
  }),
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    cost: integer("cost").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    globalCooldownSeconds: integer("global_cooldown_seconds").default(0).notNull(),
    viewerCooldownSeconds: integer("viewer_cooldown_seconds").default(0).notNull(),
    stock: integer("stock"),
    previewImageUrl: text("preview_image_url"),
    accentColor: varchar("accent_color", { length: 16 }).default("#b4ff39").notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    streamerbotActionRef: varchar("streamerbot_action_ref", { length: 255 }).notNull(),
    streamerbotArgsTemplate: jsonb("streamerbot_args_template").default({}).notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("catalog_items_slug_idx").on(table.slug),
  }),
);

export const pointLedger = pgTable(
  "point_ledger",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    viewerId: varchar("viewer_id", { length: 64 })
      .references(() => users.id)
      .notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    amount: integer("amount").notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 128 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: uniqueIndex("point_ledger_external_event_idx").on(table.externalEventId),
  }),
);

export const bets = pgTable("bets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  question: text("question").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  winningOptionId: varchar("winning_option_id", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const betOptions = pgTable("bet_options", {
  id: varchar("id", { length: 64 }).primaryKey(),
  betId: varchar("bet_id", { length: 64 })
    .references(() => bets.id)
    .notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  poolAmount: integer("pool_amount").default(0).notNull(),
});

export const betEntries = pgTable(
  "bet_entries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    betId: varchar("bet_id", { length: 64 })
      .references(() => bets.id)
      .notNull(),
    optionId: varchar("option_id", { length: 64 })
      .references(() => betOptions.id)
      .notNull(),
    viewerId: varchar("viewer_id", { length: 64 })
      .references(() => users.id)
      .notNull(),
    amount: integer("amount").notNull(),
    isHouseEntry: boolean("is_house_entry").default(false).notNull(),
    payoutAmount: integer("payout_amount"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    betViewerIdx: uniqueIndex("bet_entries_bet_viewer_idx").on(table.betId, table.viewerId),
  }),
);

export const liveLikeGoals = pgTable("live_like_goals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 255 }),
  targetLikeCount: integer("target_like_count").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const liveLikeGoalRewards = pgTable(
  "live_like_goal_rewards",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    goalId: varchar("goal_id", { length: 64 })
      .references(() => liveLikeGoals.id)
      .notNull(),
    broadcastId: varchar("broadcast_id", { length: 128 }).notNull(),
    likeCount: integer("like_count").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    rewardedViewerCount: integer("rewarded_viewer_count").notNull(),
    totalAmount: integer("total_amount").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    goalBroadcastIdx: uniqueIndex("live_like_goal_rewards_goal_broadcast_idx").on(
      table.goalId,
      table.broadcastId,
    ),
  }),
);

export const gameSuggestions = pgTable("game_suggestions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  slug: varchar("slug", { length: 160 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  linkUrl: text("link_url"),
  igdbId: integer("igdb_id"),
  canonicalName: varchar("canonical_name", { length: 255 }),
  coverImageUrl: text("cover_image_url"),
  releaseYear: integer("release_year"),
  platforms: jsonb("platforms").default([]).notNull(),
  genres: jsonb("genres").default([]).notNull(),
  hltbId: varchar("hltb_id", { length: 32 }),
  hltbName: varchar("hltb_name", { length: 255 }),
  hltbMainStoryMinutes: integer("hltb_main_story_minutes"),
  hltbMainExtraMinutes: integer("hltb_main_extra_minutes"),
  hltbCompletionistMinutes: integer("hltb_completionist_minutes"),
  hltbSimilarity: integer("hltb_similarity"),
  hltbFetchedAt: timestamp("hltb_fetched_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull(),
  totalVotes: integer("total_votes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameSuggestionBoosts = pgTable("game_suggestion_boosts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  suggestionId: varchar("suggestion_id", { length: 64 })
    .references(() => gameSuggestions.id)
    .notNull(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videoSuggestions = pgTable("video_suggestions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  youtubeVideoId: varchar("youtube_video_id", { length: 32 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  creatorName: varchar("creator_name", { length: 255 }).notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  videoUrl: text("video_url").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 32 }).notNull(),
  totalVotes: integer("total_votes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videoSuggestionBoosts = pgTable("video_suggestion_boosts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  suggestionId: varchar("suggestion_id", { length: 64 })
    .references(() => videoSuggestions.id)
    .notNull(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creatorSuggestions = pgTable("creator_suggestions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  slug: varchar("slug", { length: 160 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  channelUrl: text("channel_url").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  category: varchar("category", { length: 120 }),
  reason: text("reason"),
  status: varchar("status", { length: 32 }).notNull(),
  totalVotes: integer("total_votes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creatorSuggestionBoosts = pgTable("creator_suggestion_boosts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  suggestionId: varchar("suggestion_id", { length: 64 })
    .references(() => creatorSuggestions.id)
    .notNull(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const productRecommendations = pgTable(
  "product_recommendations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    context: text("context").notNull(),
    imageUrl: text("image_url").notNull(),
    href: text("href").notNull(),
    storeLabel: varchar("store_label", { length: 120 }).notNull(),
    linkKind: varchar("link_kind", { length: 32 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("product_recommendations_slug_idx").on(table.slug),
  }),
);

export const redemptions = pgTable("redemptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  viewerId: varchar("viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  catalogItemId: varchar("catalog_item_id", { length: 64 })
    .references(() => catalogItems.id)
    .notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  costAtPurchase: integer("cost_at_purchase").notNull(),
  requestSource: varchar("request_source", { length: 32 }).default("web").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  bridgeAttemptCount: integer("bridge_attempt_count").default(0).notNull(),
  claimedByBridgeId: varchar("claimed_by_bridge_id", { length: 64 }),
  queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
});

export const bridgeClients = pgTable(
  "bridge_clients",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    machineKey: varchar("machine_key", { length: 128 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    machineKeyIdx: uniqueIndex("bridge_clients_machine_key_idx").on(table.machineKey),
  }),
);

export const streamerbotEventLog = pgTable(
  "streamerbot_event_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    viewerExternalId: varchar("viewer_external_id", { length: 128 }),
    payload: jsonb("payload").default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    signatureValid: boolean("signature_valid").default(true).notNull(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex("streamerbot_event_id_idx").on(table.eventId),
  }),
);

export const quotes = pgTable(
  "quotes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    quoteNumber: integer("quote_number").notNull(),
    body: text("body").notNull(),
    createdByViewerId: varchar("created_by_viewer_id", { length: 64 })
      .references(() => users.id)
      .notNull(),
    createdByDisplayName: varchar("created_by_display_name", { length: 255 }).notNull(),
    createdByYoutubeHandle: varchar("created_by_youtube_handle", { length: 255 }),
    source: varchar("source", { length: 64 }).default("streamerbot_chat").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    quoteNumberIdx: uniqueIndex("quotes_quote_number_idx").on(table.quoteNumber),
  }),
);

export const googleRiscDeliveries = pgTable("google_risc_deliveries", {
  jti: varchar("jti", { length: 255 }).primaryKey(),
  eventTypes: jsonb("event_types").default([]).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  matchedAccountCount: integer("matched_account_count").default(0).notNull(),
  lastError: text("last_error"),
});

export const quoteOverlayState = pgTable("quote_overlay_state", {
  slot: varchar("slot", { length: 32 }).primaryKey(),
  overlayId: varchar("overlay_id", { length: 64 }).notNull(),
  quoteNumber: integer("quote_number").notNull(),
  quoteBody: text("quote_body").notNull(),
  createdByDisplayName: varchar("created_by_display_name", { length: 255 }).notNull(),
  createdByYoutubeHandle: varchar("created_by_youtube_handle", { length: 255 }),
  requestedByViewerId: varchar("requested_by_viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  requestedByDisplayName: varchar("requested_by_display_name", { length: 255 }).notNull(),
  requestedByYoutubeHandle: varchar("requested_by_youtube_handle", { length: 255 }),
  source: varchar("source", { length: 64 }).default("streamerbot_chat").notNull(),
  cost: integer("cost").notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const obsOverlayControl = pgTable("obs_overlay_control", {
  key: varchar("key", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  resumedAt: timestamp("resumed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  lastError: text("last_error"),
});

export const quoteOverlayQueue = pgTable("quote_overlay_queue", {
  id: varchar("id", { length: 64 }).primaryKey(),
  quoteNumber: integer("quote_number").notNull(),
  quoteBody: text("quote_body").notNull(),
  createdByDisplayName: varchar("created_by_display_name", { length: 255 }).notNull(),
  createdByYoutubeHandle: varchar("created_by_youtube_handle", { length: 255 }),
  requestedByViewerId: varchar("requested_by_viewer_id", { length: 64 })
    .references(() => users.id)
    .notNull(),
  requestedByDisplayName: varchar("requested_by_display_name", { length: 255 }).notNull(),
  requestedByYoutubeHandle: varchar("requested_by_youtube_handle", { length: 255 }),
  source: varchar("source", { length: 64 }).default("streamerbot_chat").notNull(),
  cost: integer("cost").notNull(),
  displayDurationSeconds: integer("display_duration_seconds").notNull(),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
});

export const streamerbotCounters = pgTable("streamerbot_counters", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
});
