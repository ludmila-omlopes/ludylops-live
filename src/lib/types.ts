export type CatalogItemType =
  | "onscreen_text"
  | "play_sound"
  | "show_image"
  | "overlay_scene_trigger"
  | "generic_streamerbot_action";

export type LedgerKind =
  | "presence_tick"
  | "chat_bonus"
  | "channel_subscription"
  | "like_goal_reward"
  | "admin_airdrop"
  | "manual_adjustment"
  | "redemption_debit"
  | "redemption_refund"
  | "bet_debit"
  | "bet_payout"
  | "bet_refund"
  | "game_suggestion_creation"
  | "game_suggestion_boost"
  | "video_suggestion_creation"
  | "video_suggestion_boost"
  | "creator_suggestion_creation"
  | "creator_suggestion_boost"
  | "quote_overlay_debit";

export type BetStatus =
  | "draft"
  | "open"
  | "locked"
  | "resolved"
  | "cancelled";

export type RedemptionStatus =
  | "queued"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type StreamerbotEventType =
  | "presence_tick"
  | "chat_bonus"
  | "manual_adjustment"
  | "channel_subscription"
  | "like_count_update";

export type GameSuggestionStatus =
  | "open"
  | "accepted"
  | "played"
  | "rejected";

export type VideoSuggestionStatus =
  | "open"
  | "accepted"
  | "reacted"
  | "rejected";

export type CreatorSuggestionStatus =
  | "open"
  | "accepted"
  | "featured"
  | "rejected";

export type CreatorPlatform =
  | "youtube"
  | "twitch"
  | "kick"
  | "other";

export type ProductRecommendationCategory = string;

export type ProductRecommendationLinkKind =
  | "external"
  | "affiliate";

export interface ViewerRecord {
  id: string;
  googleUserId: string | null;
  email: string | null;
  youtubeChannelId: string;
  youtubeDisplayName: string;
  youtubeHandle?: string | null;
  avatarUrl: string | null;
  isLinked: boolean;
  excludeFromRanking: boolean;
  createdAt: string;
}

export interface GoogleAccountRecord {
  id: string;
  googleUserId: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeViewerId: string | null;
  crossAccountProtectionState: "ok" | "google_signin_blocked";
  crossAccountProtectionEvent: string | null;
  crossAccountProtectionReason: string | null;
  crossAccountProtectionUpdatedAt: string;
  sessionsRevokedAt: string | null;
  createdAt: string;
}

export interface GoogleAccountViewerRecord {
  id: string;
  googleAccountId: string;
  viewerId: string;
  createdAt: string;
}

export interface ViewerLinkRecord {
  id: string;
  googleAccountId: string;
  linkCode: string;
  expiresAt: string;
  claimedAt: string | null;
}

export interface GoogleRiscDeliveryRecord {
  jti: string;
  eventTypes: string[];
  receivedAt: string;
  issuedAt: string | null;
  processedAt: string | null;
  matchedAccountCount: number;
  lastError: string | null;
}

export interface ViewerChannelOptionRecord {
  id: string;
  youtubeChannelId: string;
  youtubeDisplayName: string;
  youtubeHandle?: string | null;
  isLinked: boolean;
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  hasPlatformData: boolean;
}

export interface ViewerBalanceRecord {
  viewerId: string;
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastSyncedAt: string;
}

export interface AdminViewerDirectoryRecord {
  id: string;
  email: string | null;
  googleUserId: string | null;
  youtubeChannelId: string;
  youtubeDisplayName: string;
  youtubeHandle?: string | null;
  avatarUrl: string | null;
  isLinked: boolean;
  excludeFromRanking: boolean;
  createdAt: string;
  currentBalance: number | null;
  lifetimeEarned: number | null;
  lifetimeSpent: number | null;
  lastSyncedAt: string | null;
  googleAccountId: string | null;
  googleAccountEmail: string | null;
  googleAccountDisplayName: string | null;
  googleAccountActiveViewerId: string | null;
  isSyntheticYoutubeChannel: boolean;
}

export interface AdminViewerLinkResult {
  googleAccountId: string;
  sourceViewerId: string;
  targetViewerId: string;
  transferredOwnerLink: boolean;
  viewer: AdminViewerDirectoryRecord;
}

export interface AdminViewerChannelAttachResult {
  googleAccountId: string;
  viewerId: string;
  viewer: AdminViewerDirectoryRecord;
}

export interface CatalogItemRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: CatalogItemType;
  cost: number;
  isActive: boolean;
  globalCooldownSeconds: number;
  viewerCooldownSeconds: number;
  stock: number | null;
  previewImageUrl: string | null;
  accentColor: string;
  isFeatured: boolean;
  streamerbotActionRef: string;
  streamerbotArgsTemplate: Record<string, unknown>;
}

export interface RedemptionRecord {
  id: string;
  viewerId: string;
  catalogItemId: string;
  status: RedemptionStatus;
  costAtPurchase: number;
  requestSource: string;
  idempotencyKey: string;
  bridgeAttemptCount: number;
  claimedByBridgeId: string | null;
  queuedAt: string;
  executedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface LedgerEntryRecord {
  id: string;
  viewerId: string;
  kind: LedgerKind;
  amount: number;
  source: string;
  externalEventId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PipetzSpendingHistoryRecord {
  id: string;
  viewerId: string;
  kind: LedgerKind | "redemption_purchase";
  label: string;
  amount: number;
  source: string;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface BridgeClientRecord {
  id: string;
  machineKey: string;
  label: string;
  lastSeenAt: string;
}

export interface QuoteRecord {
  id: string;
  quoteNumber: number;
  body: string;
  createdByViewerId: string;
  createdByDisplayName: string;
  createdByYoutubeHandle: string | null;
  source: string;
  createdAt: string;
}

export interface QuoteOverlayStateRecord {
  slot: string;
  overlayId: string;
  quoteNumber: number;
  quoteBody: string;
  createdByDisplayName: string;
  createdByYoutubeHandle: string | null;
  requestedByViewerId: string;
  requestedByDisplayName: string;
  requestedByYoutubeHandle: string | null;
  source: string;
  cost: number;
  activatedAt: string;
  expiresAt: string;
}

export type ObsOverlayControlStatus = "active" | "paused" | "processing" | "error";

export type QuoteOverlayQueueStatus = "queued" | "processing" | "completed" | "cancelled" | "expired" | "failed";

export interface ObsOverlayControlRecord {
  key: string;
  status: ObsOverlayControlStatus;
  pausedAt: string | null;
  resumedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  lastError: string | null;
}

export interface QuoteOverlayQueueRecord {
  id: string;
  quoteNumber: number;
  quoteBody: string;
  createdByDisplayName: string;
  createdByYoutubeHandle: string | null;
  requestedByViewerId: string;
  requestedByDisplayName: string;
  requestedByYoutubeHandle: string | null;
  source: string;
  cost: number;
  displayDurationSeconds: number;
  status: QuoteOverlayQueueStatus;
  queuedAt: string;
  expiresAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
}

export interface ObsOverlayAdminStatusRecord {
  control: ObsOverlayControlRecord;
  activeOverlay: QuoteOverlayStateRecord | null;
  pending: QuoteOverlayQueueRecord[];
  pendingCount: number;
  processingCount: number;
  failedCount: number;
}

export interface PipetzPricingRecord {
  gameSuggestionCost: number;
  videoSuggestionCost: number;
  quoteOverlayCost: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface StreamerbotCounterRecord {
  key: string;
  scopeType: string;
  scopeKey: string;
  value: number;
  lastResetAt: string | null;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface StreamerbotCounterSummaryRecord {
  key: string;
  label: string;
  scopeType: "global" | "game";
  scopeKey: string;
  scopeLabel: string | null;
  value: number;
  lastResetAt: string | null;
  updatedAt: string;
  lastAction: string | null;
  lastAmount: number | null;
  source: string | null;
}

export interface LivestreamManualOverrideRecord {
  isLive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ActiveDeathCounterGameRecord {
  scopeType: "game";
  scopeKey: string;
  scopeLabel: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CurrentGameRecord {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface LivestreamStatusRecord {
  isLive: boolean;
  source: "automatic" | "manual";
  manualOverride: LivestreamManualOverrideRecord | null;
}

export interface BetRecord {
  id: string;
  question: string;
  status: BetStatus;
  openedAt: string | null;
  closesAt: string;
  lockedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  winningOptionId: string | null;
  createdAt: string;
}

export interface BetOptionRecord {
  id: string;
  betId: string;
  label: string;
  sortOrder: number;
  poolAmount: number;
}

export interface BetEntryRecord {
  id: string;
  betId: string;
  optionId: string;
  viewerId: string;
  amount: number;
  isHouseEntry?: boolean;
  payoutAmount: number | null;
  settledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface LiveLikeGoalRecord {
  id: string;
  label: string | null;
  targetLikeCount: number;
  rewardAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveLikeGoalRewardRecord {
  id: string;
  goalId: string;
  broadcastId: string;
  likeCount: number;
  rewardAmount: number;
  rewardedViewerCount: number;
  totalAmount: number;
  paidAt: string;
}

export interface LiveLikeGoalAdminRecord extends LiveLikeGoalRecord {
  lastReward: LiveLikeGoalRewardRecord | null;
}

export interface BetViewerPositionRecord {
  amount: number;
  optionId: string;
  payoutAmount: number | null;
  refundedAt: string | null;
  settledAt: string | null;
  isWinner: boolean | null;
}

export interface BetAdminSummaryRecord {
  entryCount: number;
  participantCount: number;
  settledCount: number;
  refundedCount: number;
  totalStake: number;
  totalPayout: number;
  totalRefunded: number;
  winningPool: number;
  losingPool: number;
  lastEntryAt: string | null;
}

export interface BetWithOptionsRecord extends BetRecord {
  totalPool: number;
  options: BetOptionRecord[];
  viewerPosition: BetViewerPositionRecord | null;
  adminSummary?: BetAdminSummaryRecord;
}

export interface GameSuggestionRecord {
  id: string;
  viewerId: string;
  slug: string;
  name: string;
  description: string | null;
  linkUrl: string | null;
  igdbId: number | null;
  canonicalName: string | null;
  coverImageUrl: string | null;
  releaseYear: number | null;
  platforms: string[];
  genres: string[];
  status: GameSuggestionStatus;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameSuggestionBoostRecord {
  id: string;
  suggestionId: string;
  viewerId: string;
  amount: number;
  createdAt: string;
}

export interface GameSuggestionWithMeta extends GameSuggestionRecord {
  suggestedBy: string;
  suggestedByYoutubeHandle: string | null;
  viewerBoostTotal: number;
}

export interface VideoSuggestionRecord {
  id: string;
  viewerId: string;
  youtubeVideoId: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string;
  videoUrl: string;
  reason: string | null;
  status: VideoSuggestionStatus;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSuggestionBoostRecord {
  id: string;
  suggestionId: string;
  viewerId: string;
  amount: number;
  createdAt: string;
}

export interface VideoSuggestionWithMeta extends VideoSuggestionRecord {
  suggestedBy: string;
  suggestedByYoutubeHandle: string | null;
  viewerBoostTotal: number;
}

export interface CreatorSuggestionRecord {
  id: string;
  viewerId: string;
  slug: string;
  name: string;
  channelUrl: string;
  platform: CreatorPlatform;
  category: string | null;
  reason: string | null;
  status: CreatorSuggestionStatus;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorSuggestionBoostRecord {
  id: string;
  suggestionId: string;
  viewerId: string;
  amount: number;
  createdAt: string;
}

export interface CreatorSuggestionWithMeta extends CreatorSuggestionRecord {
  suggestedBy: string;
  suggestedByYoutubeHandle: string | null;
  viewerBoostTotal: number;
}

export interface ProductRecommendationRecord {
  id: string;
  slug: string;
  name: string;
  category: ProductRecommendationCategory;
  context: string;
  imageUrl: string;
  href: string;
  storeLabel: string;
  linkKind: ProductRecommendationLinkKind;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
