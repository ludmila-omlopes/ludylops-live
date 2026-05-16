import {
  BetEntryRecord,
  BetOptionRecord,
  BetRecord,
  BridgeClientRecord,
  CatalogItemRecord,
  CreatorSuggestionBoostRecord,
  CreatorSuggestionRecord,
  GameSuggestionBoostRecord,
  GameSuggestionRecord,
  GoogleAccountRecord,
  GoogleAccountViewerRecord,
  GoogleRiscDeliveryRecord,
  LedgerEntryRecord,
  QuoteRecord,
  ProductRecommendationRecord,
  RedemptionRecord,
  VideoSuggestionBoostRecord,
  VideoSuggestionRecord,
  ViewerBalanceRecord,
  ViewerRecord,
} from "@/lib/types";

const now = new Date();

export const demoViewers: ViewerRecord[] = [
  {
    id: "viewer_ana",
    googleUserId: "google_ana",
    email: "ana@example.com",
    youtubeChannelId: "yt_ana",
    youtubeDisplayName: "Ana Neon",
    youtubeHandle: "@ananeon",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    isLinked: true,
    excludeFromRanking: false,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: "viewer_caio",
    googleUserId: "google_caio",
    email: "caio@example.com",
    youtubeChannelId: "yt_caio",
    youtubeDisplayName: "Caio CRT",
    youtubeHandle: "@caiocrt",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    isLinked: true,
    excludeFromRanking: false,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "viewer_lia",
    googleUserId: null,
    email: null,
    youtubeChannelId: "yt_lia",
    youtubeDisplayName: "Lia Pixel",
    youtubeHandle: "@liapixel",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    isLinked: false,
    excludeFromRanking: false,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
  },
];

export const demoGoogleAccounts: GoogleAccountRecord[] = [
  {
    id: "ga_ana",
    googleUserId: "google_ana",
    email: "ana@example.com",
    displayName: "Ana",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    activeViewerId: "viewer_ana",
    crossAccountProtectionState: "ok",
    crossAccountProtectionEvent: null,
    crossAccountProtectionReason: null,
    crossAccountProtectionUpdatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    sessionsRevokedAt: null,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: "ga_caio",
    googleUserId: "google_caio",
    email: "caio@example.com",
    displayName: "Caio",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    activeViewerId: "viewer_caio",
    crossAccountProtectionState: "ok",
    crossAccountProtectionEvent: null,
    crossAccountProtectionReason: null,
    crossAccountProtectionUpdatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    sessionsRevokedAt: null,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

export const demoGoogleAccountViewers: GoogleAccountViewerRecord[] = [
  {
    id: "gav_ana_1",
    googleAccountId: "ga_ana",
    viewerId: "viewer_ana",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: "gav_caio_1",
    googleAccountId: "ga_caio",
    viewerId: "viewer_caio",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

export const demoGoogleRiscDeliveries: GoogleRiscDeliveryRecord[] = [];

export const demoBalances: ViewerBalanceRecord[] = [
  {
    viewerId: "viewer_ana",
    currentBalance: 1420,
    lifetimeEarned: 1880,
    lifetimeSpent: 460,
    lastSyncedAt: now.toISOString(),
  },
  {
    viewerId: "viewer_caio",
    currentBalance: 980,
    lifetimeEarned: 1260,
    lifetimeSpent: 280,
    lastSyncedAt: now.toISOString(),
  },
  {
    viewerId: "viewer_lia",
    currentBalance: 520,
    lifetimeEarned: 620,
    lifetimeSpent: 100,
    lastSyncedAt: now.toISOString(),
  },
];

export const demoCatalog: CatalogItemRecord[] = [
  {
    id: "item_horn",
    slug: "buzina-neon",
    name: "Buzina Neon",
    description: "Toca uma vinheta curta para cortar o caos da live.",
    type: "play_sound",
    cost: 180,
    isActive: true,
    globalCooldownSeconds: 15,
    viewerCooldownSeconds: 60,
    stock: null,
    previewImageUrl:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    accentColor: "#b4ff39",
    isFeatured: true,
    streamerbotActionRef: "Play Approved Sound",
    streamerbotArgsTemplate: { soundKey: "neon_horn" },
  },
  {
    id: "item_flash",
    slug: "flash-na-tela",
    name: "Flash na Tela",
    description: "Aciona um overlay agressivo no palco digital.",
    type: "overlay_scene_trigger",
    cost: 250,
    isActive: true,
    globalCooldownSeconds: 25,
    viewerCooldownSeconds: 90,
    stock: null,
    previewImageUrl:
      "https://images.unsplash.com/photo-1520034475321-cbe63696469a?auto=format&fit=crop&w=900&q=80",
    accentColor: "#00e7ff",
    isFeatured: true,
    streamerbotActionRef: "Trigger Overlay Scene",
    streamerbotArgsTemplate: { sceneKey: "flash_brutalist" },
  },
  {
    id: "item_sticker",
    slug: "sticker-holografico",
    name: "Sticker Holográfico",
    description: "Mostra uma arte aprovada no overlay por alguns segundos.",
    type: "show_image",
    cost: 320,
    isActive: true,
    globalCooldownSeconds: 20,
    viewerCooldownSeconds: 120,
    stock: 20,
    previewImageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    accentColor: "#ff46e0",
    isFeatured: false,
    streamerbotActionRef: "Show Approved Image",
    streamerbotArgsTemplate: { imageKey: "holo_sticker" },
  },
];

export const demoProductRecommendations: ProductRecommendationRecord[] = [];

export const demoLedger: LedgerEntryRecord[] = [
  {
    id: "ledger_1",
    viewerId: "viewer_ana",
    kind: "presence_tick",
    amount: 5,
    source: "streamerbot",
    externalEventId: "evt_presence_1",
    metadata: { liveId: "live_demo" },
    createdAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "ledger_2",
    viewerId: "viewer_caio",
    kind: "chat_bonus",
    amount: 2,
    source: "streamerbot",
    externalEventId: "evt_chat_1",
    metadata: { liveId: "live_demo" },
    createdAt: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
  },
];

export const demoRedemptions: RedemptionRecord[] = [
  {
    id: "red_1",
    viewerId: "viewer_ana",
    catalogItemId: "item_horn",
    status: "completed",
    costAtPurchase: 180,
    requestSource: "web",
    idempotencyKey: "idem_red_1",
    bridgeAttemptCount: 1,
    claimedByBridgeId: "bridge_local",
    queuedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    executedAt: new Date(now.getTime() - 1000 * 60 * 29).toISOString(),
    failedAt: null,
    failureReason: null,
  },
  {
    id: "red_2",
    viewerId: "viewer_caio",
    catalogItemId: "item_flash",
    status: "queued",
    costAtPurchase: 250,
    requestSource: "web",
    idempotencyKey: "idem_red_2",
    bridgeAttemptCount: 0,
    claimedByBridgeId: null,
    queuedAt: new Date(now.getTime() - 1000 * 60).toISOString(),
    executedAt: null,
    failedAt: null,
    failureReason: null,
  },
];

export const demoBridgeClients: BridgeClientRecord[] = [
  {
    id: "bridge_local",
    machineKey: "dev-machine",
    label: "PC da Stream",
    lastSeenAt: now.toISOString(),
  },
];

export const demoQuotes: QuoteRecord[] = [
  {
    id: "quote_1",
    quoteNumber: 1,
    body: "isso aqui vai dar muito certo, confia",
    createdByViewerId: "viewer_ana",
    createdByDisplayName: "Ana Neon",
    createdByYoutubeHandle: "@ananeon",
    source: "streamerbot_chat",
    createdAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "quote_2",
    quoteNumber: 2,
    body: "se eu morrer, foi estrategia",
    createdByViewerId: "viewer_caio",
    createdByDisplayName: "Caio CRT",
    createdByYoutubeHandle: "@caiocrt",
    source: "streamerbot_chat",
    createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
  },
];

// ── Bets (mock) ──

export interface DemoBetOption {
  id: string;
  label: string;
  poolAmount: number;
}

export interface DemoBet {
  id: string;
  question: string;
  status: "open" | "locked" | "resolved" | "cancelled";
  deadline: Date;
  totalPool: number;
  winningOptionId?: string;
  options: DemoBetOption[];
}

export const demoBets: DemoBet[] = [
  {
    id: "bet-1",
    question: "Ela vai zerar o boss sem morrer?",
    status: "open",
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
    totalPool: 4650,
    options: [
      { id: "opt-1a", label: "Sim, first try!", poolAmount: 1250 },
      { id: "opt-1b", label: "Vai morrer pelo menos 3x", poolAmount: 3400 },
    ],
  },
  {
    id: "bet-2",
    question: "Quanto tempo ate zerar o jogo?",
    status: "resolved",
    deadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
    totalPool: 8200,
    winningOptionId: "opt-2b",
    options: [
      { id: "opt-2a", label: "Menos de 5h", poolAmount: 2100 },
      { id: "opt-2b", label: "5-10h", poolAmount: 4800 },
      { id: "opt-2c", label: "Mais de 10h", poolAmount: 1300 },
    ],
  },
  {
    id: "bet-3",
    question: "Vai achar o item secreto na live de hoje?",
    status: "open",
    deadline: new Date(Date.now() + 45 * 60 * 1000),
    totalPool: 1820,
    options: [
      { id: "opt-3a", label: "Acha facil", poolAmount: 320 },
      { id: "opt-3b", label: "Demora mas acha", poolAmount: 980 },
      { id: "opt-3c", label: "Nem encontra", poolAmount: 520 },
    ],
  },
];

export const demoBetRecords: BetRecord[] = demoBets.map((bet) => ({
  id: bet.id,
  question: bet.question,
  status: bet.status,
  openedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
  closesAt: bet.deadline.toISOString(),
  lockedAt: bet.status === "locked" || bet.status === "resolved" ? bet.deadline.toISOString() : null,
  resolvedAt: bet.status === "resolved" ? new Date(now.getTime() - 5 * 60 * 1000).toISOString() : null,
  cancelledAt: bet.status === "cancelled" ? new Date(now.getTime() - 5 * 60 * 1000).toISOString() : null,
  winningOptionId: bet.winningOptionId ?? null,
  createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
}));

export const demoBetOptions: BetOptionRecord[] = demoBets.flatMap((bet) =>
  bet.options.map((option, index) => ({
    id: option.id,
    betId: bet.id,
    label: option.label,
    sortOrder: index,
    poolAmount: option.poolAmount,
  })),
);

export const demoBetEntries: BetEntryRecord[] = [
  {
    id: "bet-entry-1",
    betId: "bet-2",
    optionId: "opt-2b",
    viewerId: "viewer_ana",
    amount: 400,
    payoutAmount: 683,
    settledAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
    refundedAt: null,
    createdAt: new Date(now.getTime() - 29 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Game Suggestions (mock) ──

export const demoGameSuggestions: GameSuggestionRecord[] = [
  {
    id: "gs-1",
    viewerId: "viewer_ana",
    slug: "hollow-knight-silksong",
    name: "Hollow Knight: Silksong",
      description: "Quando sair, bora de day one!",
      linkUrl: null,
      igdbId: 119388,
      canonicalName: "Hollow Knight: Silksong",
      coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8hpl.jpg",
      releaseYear: 2025,
      platforms: ["PC", "Nintendo Switch"],
      genres: ["Platform", "Adventure"],
      totalVotes: 3200,
    status: "open",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "gs-2",
    viewerId: "viewer_caio",
    slug: "celeste",
    name: "Celeste",
      description: "Platformer indie que vai te fazer chorar e xingar ao mesmo tempo",
      linkUrl: null,
      igdbId: 20342,
      canonicalName: "Celeste",
      coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co3byy.jpg",
      releaseYear: 2018,
      platforms: ["PC", "Nintendo Switch"],
      genres: ["Platform", "Adventure"],
      totalVotes: 1800,
    status: "accepted",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 54).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "gs-3",
    viewerId: "viewer_lia",
    slug: "elden-ring-dlc",
    name: "Elden Ring DLC",
      description: "Shadow of the Erdtree, pra sofrer junto",
      linkUrl: null,
      igdbId: null,
      canonicalName: null,
      coverImageUrl: null,
      releaseYear: null,
      platforms: [],
      genres: [],
      totalVotes: 2950,
    status: "played",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 44).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    id: "gs-4",
    viewerId: "viewer_caio",
    slug: "hades-ii",
    name: "Hades II",
      description: "Early access ja ta incrivel",
      linkUrl: null,
      igdbId: 240007,
      canonicalName: "Hades II",
      coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co88ac.jpg",
      releaseYear: 2024,
      platforms: ["PC"],
      genres: ["Role-playing", "Hack and slash"],
      totalVotes: 1200,
    status: "open",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 20).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "gs-5",
    viewerId: "viewer_ana",
    slug: "outer-wilds",
    name: "Outer Wilds",
      description: "Melhor jogo de exploracao que existe. Sem spoilers!",
      linkUrl: null,
      igdbId: 11156,
      canonicalName: "Outer Wilds",
      coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co65ac.jpg",
      releaseYear: 2019,
      platforms: ["PC", "PlayStation 4"],
      genres: ["Adventure", "Puzzle"],
      totalVotes: 890,
    status: "open",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
  },
];

export const demoGameSuggestionBoosts: GameSuggestionBoostRecord[] = [];

export const demoCreatorSuggestions: CreatorSuggestionRecord[] = [
  {
    id: "cs-1",
    viewerId: "viewer_lia",
    slug: "canal-pequena-grande-ideia",
    name: "Pequena Grande Ideia",
    channelUrl: "https://www.youtube.com/@pequenagrandeideia",
    platform: "youtube",
    category: "ensaios e cultura pop",
    reason: "Canal bom para descobrir videos longos, bem editados e cheios de pauta para live.",
    totalVotes: 700,
    status: "open",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 40).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "cs-2",
    viewerId: "viewer_caio",
    slug: "streamer-cozy-games-br",
    name: "Cozy Games BR",
    channelUrl: "https://www.twitch.tv/cozygamesbr",
    platform: "twitch",
    category: "indies e cozy games",
    reason: "Lives tranquilas e com bastante jogo indie para conhecer.",
    totalVotes: 420,
    status: "accepted",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 22).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

export const demoCreatorSuggestionBoosts: CreatorSuggestionBoostRecord[] = [];

export const demoVideoSuggestions: VideoSuggestionRecord[] = [
  {
    id: "vs-1",
    viewerId: "viewer_ana",
    youtubeVideoId: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    creatorName: "Rick Astley",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    reason: "Classico absoluto pra reagir com o chat.",
    totalVotes: 900,
    status: "open",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "vs-2",
    viewerId: "viewer_caio",
    youtubeVideoId: "M7lc1UVf-VE",
    title: "YouTube Developers Live: Embedded Web Player Customization",
    creatorName: "Google for Developers",
    thumbnailUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    reason: "Quero ver voce comentando o caos tecnico disso.",
    totalVotes: 520,
    status: "accepted",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

export const demoVideoSuggestionBoosts: VideoSuggestionBoostRecord[] = [];
