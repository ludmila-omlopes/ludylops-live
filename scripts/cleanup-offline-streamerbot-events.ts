import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

import {
  buildBroadcastIntervals,
  buildViewerBalanceRollback,
  classifyOccurredAt,
  type BroadcastRecord,
} from "../src/lib/streamerbot/offline-cleanup";

function createSqlClient(databaseUrl: string) {
  return neon(databaseUrl);
}

type SqlClient = ReturnType<typeof createSqlClient>;
type SummaryValue = string | number | boolean;

type CliOptions = {
  apply: boolean;
  dryRun: boolean;
  verbose: boolean;
  from: string | null;
  to: string | null;
  maxPages: number;
  channelIds: string[];
};

type SearchResponseItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    channelId?: string;
    title?: string;
    publishedAt?: string;
  };
};

type SearchResponse = {
  nextPageToken?: string;
  items?: SearchResponseItem[];
};

type VideoResponseItem = {
  id: string;
  snippet?: {
    channelId?: string;
    title?: string;
  };
  liveStreamingDetails?: {
    actualStartTime?: string;
    actualEndTime?: string;
    scheduledStartTime?: string;
    scheduledEndTime?: string;
  };
};

type EventRangeRow = {
  min_occurred_at: string | null;
  max_occurred_at: string | null;
  total_events: number | string;
};

type StreamerbotEventRow = {
  event_log_row_id: string;
  event_id: string;
  event_type: "presence_tick" | "chat_bonus" | "link_code_seen";
  viewer_external_id: string | null;
  occurred_at: string;
  payload: unknown;
  ledger_id: string | null;
  viewer_id: string | null;
  amount: number | null;
  ledger_kind: string | null;
  viewer_display_name: string | null;
};

type ViewerBalanceRow = {
  viewer_id: string;
  current_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
};

type SearchWindow = {
  publishedAfter: string | null;
  publishedBefore: string | null;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_FILES = [resolve(ROOT, ".env.local"), resolve(ROOT, ".env")];
const LIVE_GATED_EVENT_TYPES = ["presence_tick", "chat_bonus", "link_code_seen"] as const;
const SEARCH_EVENT_TYPES = ["completed", "live"] as const;
const VIDEOS_BATCH_SIZE = 50;
const SEARCH_REQUEST_TIMEOUT_MS = 15_000;
const SEARCH_BUFFER_DAYS = 30;

function loadEnvFile(filepath: string) {
  if (!existsSync(filepath)) {
    return;
  }

  const raw = readFileSync(filepath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadLocalEnv() {
  for (const filepath of ENV_FILES) {
    loadEnvFile(filepath);
  }
}

function splitCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function parseIsoArg(label: string, value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return new Date(timestamp).toISOString();
}

function shiftIso(value: string, days: number) {
  const timestamp = Date.parse(value);
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const channelIds: string[] = [];
  let apply = false;
  let verbose = false;
  let from: string | null = null;
  let to: string | null = null;
  let maxPages = 8;

  const readValue = (index: number, flag: string) => {
    const nextValue = args[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${flag}.`);
    }
    return nextValue;
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === "--help") {
      console.info(`Usage:
  npx tsx scripts/cleanup-offline-streamerbot-events.ts [--dry-run] [--apply]
    [--channel-id UC...] [--from 2026-03-01T00:00:00Z] [--to 2026-03-31T23:59:59Z]
    [--max-pages 8] [--verbose]

Notes:
  - Dry-run is the default mode.
  - --apply creates DB backup rows before rollbacking offline presence/chat events.
  - Offline link_code_seen events are reported and backed up for manual review only.
`);
      process.exit(0);
    }

    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--channel-id") {
      channelIds.push(readValue(index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--channel-id=")) {
      channelIds.push(arg.slice("--channel-id=".length));
      continue;
    }

    if (arg === "--from") {
      from = readValue(index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--from=")) {
      from = arg.slice("--from=".length);
      continue;
    }

    if (arg === "--to") {
      to = readValue(index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--to=")) {
      to = arg.slice("--to=".length);
      continue;
    }

    if (arg === "--max-pages") {
      maxPages = Number(readValue(index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--max-pages=")) {
      maxPages = Number(arg.slice("--max-pages=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error(`Invalid --max-pages value: ${maxPages}`);
  }

  const normalizedFrom = parseIsoArg("--from", from);
  const normalizedTo = parseIsoArg("--to", to);

  if (normalizedFrom && normalizedTo && Date.parse(normalizedFrom) > Date.parse(normalizedTo)) {
    throw new Error("--from must be before --to.");
  }

  return {
    apply,
    dryRun: !apply,
    verbose,
    from: normalizedFrom,
    to: normalizedTo,
    maxPages,
    channelIds: dedupe(channelIds),
  } satisfies CliOptions;
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (!payload) {
    return {};
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return normalizePayload(parsed);
    } catch {
      return {};
    }
  }

  return typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function extractLinkCode(payload: Record<string, unknown>) {
  const directMatch = payload.linkCode;
  if (typeof directMatch === "string" && directMatch.trim()) {
    return directMatch.trim();
  }

  const fallbackMatch = payload.code;
  return typeof fallbackMatch === "string" && fallbackMatch.trim() ? fallbackMatch.trim() : null;
}

async function resolveTrackedYoutubeChannelIds(
  sql: SqlClient,
  options: CliOptions,
) {
  const configuredChannelIds = dedupe([
    ...options.channelIds,
    ...splitCsv(process.env.STREAM_YOUTUBE_CHANNEL_ID),
  ]);

  if (configuredChannelIds.length > 0) {
    return configuredChannelIds;
  }

  const adminEmails = new Set(splitCsv(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase()));
  if (adminEmails.size === 0) {
    throw new Error(
      "Missing tracked channel information. Set --channel-id, STREAM_YOUTUBE_CHANNEL_ID, or ADMIN_EMAILS with a linked admin user.",
    );
  }

  const rows = (await sql`
    SELECT ga.email, users.youtube_channel_id
    FROM google_account_viewers gav
    INNER JOIN google_accounts ga
      ON ga.id = gav.google_account_id
    INNER JOIN users
      ON users.id = gav.viewer_id
    WHERE users.is_linked = true
      AND ga.email IS NOT NULL
      AND users.youtube_channel_id IS NOT NULL
  `) as Array<{ email: string; youtube_channel_id: string }>;

  const channelIds = dedupe(
    rows
      .filter((row) => adminEmails.has(row.email.toLowerCase()))
      .map((row) => row.youtube_channel_id),
  );

  if (channelIds.length === 0) {
    throw new Error(
      "No linked admin YouTube channel id found. Link the admin account first or pass --channel-id / STREAM_YOUTUBE_CHANNEL_ID.",
    );
  }

  return channelIds;
}

async function loadEventRange(sql: SqlClient, options: CliOptions) {
  const [row] = (await sql`
    SELECT
      MIN(occurred_at) AS min_occurred_at,
      MAX(occurred_at) AS max_occurred_at,
      COUNT(*) AS total_events
    FROM streamerbot_event_log
    WHERE event_type = ANY(${Array.from(LIVE_GATED_EVENT_TYPES)})
      AND (${options.from}::timestamptz IS NULL OR occurred_at >= ${options.from}::timestamptz)
      AND (${options.to}::timestamptz IS NULL OR occurred_at <= ${options.to}::timestamptz)
  `) as EventRangeRow[];

  return {
    minOccurredAt: row?.min_occurred_at ?? null,
    maxOccurredAt: row?.max_occurred_at ?? null,
    totalEvents: Number(row?.total_events ?? 0),
  };
}

function buildSearchWindow(range: { minOccurredAt: string | null; maxOccurredAt: string | null }, options: CliOptions): SearchWindow {
  const lowerBound = options.from ?? range.minOccurredAt;
  const upperBound = options.to ?? range.maxOccurredAt;

  return {
    publishedAfter: lowerBound ? shiftIso(lowerBound, -SEARCH_BUFFER_DAYS) : null,
    publishedBefore: upperBound ? shiftIso(upperBound, 1) : null,
  };
}

async function fetchJson<T>(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`YouTube API request failed with ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBroadcastVideos(params: {
  apiKey: string;
  channelId: string;
  eventType: (typeof SEARCH_EVENT_TYPES)[number];
  maxPages: number;
  searchWindow: SearchWindow;
}) {
  const items: SearchResponseItem[] = [];
  let nextPageToken: string | undefined;
  let pagesFetched = 0;
  let truncated = false;

  while (pagesFetched < params.maxPages) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("channelId", params.channelId);
    url.searchParams.set("eventType", params.eventType);
    url.searchParams.set("type", "video");
    url.searchParams.set("order", "date");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", params.apiKey);

    if (params.searchWindow.publishedAfter) {
      url.searchParams.set("publishedAfter", params.searchWindow.publishedAfter);
    }
    if (params.searchWindow.publishedBefore) {
      url.searchParams.set("publishedBefore", params.searchWindow.publishedBefore);
    }
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const response = await fetchJson<SearchResponse>(url);
    items.push(...(response.items ?? []));
    pagesFetched += 1;

    nextPageToken = response.nextPageToken;
    if (!nextPageToken) {
      break;
    }
  }

  if (nextPageToken) {
    truncated = true;
  }

  return { items, truncated, pagesFetched };
}

async function fetchBroadcastRecords(params: {
  apiKey: string;
  channelIds: string[];
  searchWindow: SearchWindow;
  maxPages: number;
  verbose: boolean;
}) {
  const recordsByVideoId = new Map<string, BroadcastRecord>();
  let historyTruncated = false;

  for (const channelId of params.channelIds) {
    const searchResults = await Promise.all(
      SEARCH_EVENT_TYPES.map(async (eventType) => ({
        eventType,
        ...(await searchBroadcastVideos({
          apiKey: params.apiKey,
          channelId,
          eventType,
          maxPages: params.maxPages,
          searchWindow: params.searchWindow,
        })),
      })),
    );

    historyTruncated ||= searchResults.some((result) => result.truncated);

    if (params.verbose) {
      for (const result of searchResults) {
        console.info(
          `[youtube-search] channel=${channelId} eventType=${result.eventType} items=${result.items.length} pages=${result.pagesFetched} truncated=${result.truncated}`,
        );
      }
    }

    const searchItems = searchResults.flatMap((result) => result.items);
    const videosBySearchResult = new Map<
      string,
      {
        title: string;
        searchEventType: "completed" | "live";
      }
    >();

    for (const result of searchResults) {
      for (const item of result.items) {
        const videoId = item.id?.videoId;
        if (!videoId) {
          continue;
        }

        videosBySearchResult.set(videoId, {
          title: item.snippet?.title?.trim() ?? videoId,
          searchEventType: result.eventType,
        });
      }
    }

    const videoIds = dedupe(
      searchItems.map((item) => item.id?.videoId).filter((value): value is string => Boolean(value)),
    );

    for (const batch of chunk(videoIds, VIDEOS_BATCH_SIZE)) {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,liveStreamingDetails");
      url.searchParams.set("id", batch.join(","));
      url.searchParams.set("key", params.apiKey);

      const response = await fetchJson<{ items?: VideoResponseItem[] }>(url);
      for (const item of response.items ?? []) {
        const metadata = videosBySearchResult.get(item.id);
        if (!metadata) {
          continue;
        }

        recordsByVideoId.set(item.id, {
          videoId: item.id,
          channelId: item.snippet?.channelId ?? channelId,
          title: item.snippet?.title?.trim() ?? metadata.title,
          searchEventType: metadata.searchEventType,
          actualStartTime: item.liveStreamingDetails?.actualStartTime ?? null,
          actualEndTime: item.liveStreamingDetails?.actualEndTime ?? null,
          scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime ?? null,
          scheduledEndTime: item.liveStreamingDetails?.scheduledEndTime ?? null,
        });
      }
    }
  }

  return {
    records: Array.from(recordsByVideoId.values()).sort((left, right) => {
      const leftTime = Date.parse(left.actualStartTime ?? left.scheduledStartTime ?? "1970-01-01T00:00:00.000Z");
      const rightTime = Date.parse(right.actualStartTime ?? right.scheduledStartTime ?? "1970-01-01T00:00:00.000Z");
      return leftTime - rightTime;
    }),
    historyTruncated,
  };
}

async function loadStreamerbotEvents(sql: SqlClient, options: CliOptions) {
  return (await sql`
    SELECT
      el.id AS event_log_row_id,
      el.event_id,
      el.event_type,
      el.viewer_external_id,
      el.occurred_at,
      el.payload,
      pl.id AS ledger_id,
      pl.viewer_id,
      pl.amount,
      pl.kind AS ledger_kind,
      users.youtube_display_name AS viewer_display_name
    FROM streamerbot_event_log el
    LEFT JOIN point_ledger pl
      ON pl.external_event_id = el.event_id
    LEFT JOIN users
      ON users.id = pl.viewer_id
    WHERE el.event_type = ANY(${Array.from(LIVE_GATED_EVENT_TYPES)})
      AND (${options.from}::timestamptz IS NULL OR el.occurred_at >= ${options.from}::timestamptz)
      AND (${options.to}::timestamptz IS NULL OR el.occurred_at <= ${options.to}::timestamptz)
    ORDER BY el.occurred_at ASC
  `) as StreamerbotEventRow[];
}

async function loadViewerBalances(sql: SqlClient, viewerIds: string[]) {
  if (viewerIds.length === 0) {
    return [];
  }

  return (await sql`
    SELECT viewer_id, current_balance, lifetime_earned, lifetime_spent
    FROM viewer_balances
    WHERE viewer_id = ANY(${viewerIds})
  `) as ViewerBalanceRow[];
}

function normalizeSummaryValue(value: unknown): SummaryValue {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value);
}

function toSummaryRecord(entries: Array<{ label: string; value: unknown }>) {
  return Object.fromEntries(entries.map((entry) => [entry.label, normalizeSummaryValue(entry.value)]));
}

async function createBackupTables(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS maintenance_streamerbot_cleanup_runs (
      run_id varchar(64) PRIMARY KEY,
      created_at timestamptz DEFAULT NOW() NOT NULL,
      applied boolean NOT NULL,
      summary text NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maintenance_streamerbot_cleanup_backup (
      run_id varchar(64) NOT NULL,
      record_type varchar(64) NOT NULL,
      record_id varchar(128),
      event_id varchar(128),
      viewer_id varchar(64),
      payload text NOT NULL,
      created_at timestamptz DEFAULT NOW() NOT NULL
    )
  `;
}

type PostRollbackCleanupCandidate = {
  viewer_id: string;
  youtube_display_name: string;
  current_balance: number;
  surviving_point_entries: number | string;
  redemption_count: number | string;
  bet_entry_count: number | string;
  link_count: number | string;
};

async function loadPostRollbackCleanupCandidates(
  sql: SqlClient,
  viewerIds: string[],
) {
  if (viewerIds.length === 0) {
    return [];
  }

  return (await sql`
    SELECT
      users.id AS viewer_id,
      users.youtube_display_name,
      viewer_balances.current_balance,
      (
        SELECT COUNT(*)
        FROM point_ledger
        WHERE point_ledger.viewer_id = users.id
      ) AS surviving_point_entries,
      (
        SELECT COUNT(*)
        FROM redemptions
        WHERE redemptions.viewer_id = users.id
      ) AS redemption_count,
      (
        SELECT COUNT(*)
        FROM bet_entries
        WHERE bet_entries.viewer_id = users.id
      ) AS bet_entry_count,
      (
        SELECT COUNT(*)
        FROM google_account_viewers
        WHERE google_account_viewers.viewer_id = users.id
      ) AS link_count
    FROM users
    INNER JOIN viewer_balances
      ON viewer_balances.viewer_id = users.id
    WHERE users.id = ANY(${viewerIds})
  `) as PostRollbackCleanupCandidate[];
}

async function main() {
  loadLocalEnv();

  const options = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Add it to .env.local/.env or export it before running.");
  }

  if (!youtubeApiKey) {
    throw new Error("Missing YOUTUBE_API_KEY. Add it to .env.local/.env or export it before running.");
  }

  const sql = createSqlClient(databaseUrl);
  if (options.apply && (await sql`SELECT to_regclass('public.creator_balances') AS storage`)[0]?.storage) {
    throw new Error("This legacy cleanup cannot delete identities after the creator economy migration. Review each currency and redemption through the application before any cleanup.");
  }
  const channelIds = await resolveTrackedYoutubeChannelIds(sql, options);
  const eventRange = await loadEventRange(sql, options);

  if (eventRange.totalEvents === 0) {
    console.info("No live-gated Streamer.bot events matched the requested range.");
    return;
  }

  const searchWindow = buildSearchWindow(eventRange, options);
  const broadcastSearch = await fetchBroadcastRecords({
    apiKey: youtubeApiKey,
    channelIds,
    searchWindow,
    maxPages: options.maxPages,
    verbose: options.verbose,
  });

  const intervals = buildBroadcastIntervals(broadcastSearch.records, new Date().toISOString());
  const events = await loadStreamerbotEvents(sql, options);

  const classifiedEvents = events.map((row) => {
    const payload = normalizePayload(row.payload);
    const classification = classifyOccurredAt(row.occurred_at, intervals.liveIntervals, intervals.reviewIntervals);
    return {
      ...row,
      payload,
      linkCode: extractLinkCode(payload),
      classification,
    };
  });

  const reviewEvents = classifiedEvents.filter((row) => row.classification === "review");
  const offlineEvents = classifiedEvents.filter((row) => row.classification === "offline");
  const offlineLinkCodeEvents = offlineEvents.filter((row) => row.event_type === "link_code_seen");
  const autoRollbackEvents = offlineEvents.filter((row) => row.event_type !== "link_code_seen");
  const autoRollbackLedgerEvents = autoRollbackEvents.filter(
    (row): row is typeof row & { ledger_id: string; viewer_id: string; amount: number } =>
      typeof row.ledger_id === "string" && typeof row.viewer_id === "string" && typeof row.amount === "number",
  );

  const rollbackByViewer = buildViewerBalanceRollback(
    autoRollbackLedgerEvents.map((row) => ({
      viewerId: row.viewer_id,
      amount: row.amount,
    })),
  );
  const affectedViewerIds = rollbackByViewer.map((row) => row.viewerId);
  const currentBalances = await loadViewerBalances(sql, affectedViewerIds);
  const currentBalancesByViewerId = new Map(currentBalances.map((row) => [row.viewer_id, row]));

  const projectedBalanceRows = rollbackByViewer.map((row) => {
    const current = currentBalancesByViewerId.get(row.viewerId);
    return {
      viewerId: row.viewerId,
      currentBalanceBefore: current?.current_balance ?? 0,
      currentBalanceAfter: (current?.current_balance ?? 0) + row.currentBalanceDelta,
      lifetimeEarnedBefore: current?.lifetime_earned ?? 0,
      lifetimeEarnedAfter: (current?.lifetime_earned ?? 0) + row.lifetimeEarnedDelta,
      lifetimeSpentBefore: current?.lifetime_spent ?? 0,
      lifetimeSpentAfter: (current?.lifetime_spent ?? 0) + row.lifetimeSpentDelta,
    };
  });

  const summary = {
    mode: options.dryRun ? "dry-run" : "apply",
    rangeStart: options.from ?? eventRange.minOccurredAt,
    rangeEnd: options.to ?? eventRange.maxOccurredAt,
    trackedChannelIds: channelIds,
    searchWindow,
    totalLiveGatedEventsInspected: events.length,
    youtubeBroadcastsFound: broadcastSearch.records.length,
    historyTruncated: broadcastSearch.historyTruncated,
    unresolvedBroadcasts: intervals.unresolvedBroadcasts.length,
    liveIntervals: intervals.liveIntervals.length,
    reviewIntervals: intervals.reviewIntervals.length,
    autoRollbackEventLogs: autoRollbackEvents.length,
    autoRollbackLedgerRows: autoRollbackLedgerEvents.length,
    autoRollbackViewers: affectedViewerIds.length,
    offlineLinkCodeSeenEvents: offlineLinkCodeEvents.length,
    reviewEvents: reviewEvents.length,
    netPointsToReverse: autoRollbackLedgerEvents.reduce((sum, row) => sum + row.amount, 0),
  };

  console.info("Cleanup summary");
  console.table([toSummaryRecord(
    Object.entries(summary).map(([label, value]) => ({
      label,
      value,
    })),
  )]);

  if (broadcastSearch.historyTruncated) {
    console.warn(
      "YouTube search results were truncated by --max-pages. Refine the range with --from/--to or rerun with a higher --max-pages before applying.",
    );
  }

  if (intervals.unresolvedBroadcasts.length > 0) {
    console.warn(`Found ${intervals.unresolvedBroadcasts.length} broadcasts without enough actual timestamps to auto-classify all events.`);
  }

  if (reviewEvents.length > 0) {
    console.warn(`Found ${reviewEvents.length} events in review-only windows. These are excluded from automated rollback.`);
    console.table(
      reviewEvents.slice(0, 20).map((row) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        occurredAt: row.occurred_at,
        viewerExternalId: row.viewer_external_id ?? "",
      })),
    );
  }

  if (offlineEvents.length > 0) {
    console.info("Offline event samples");
    console.table(
      offlineEvents.slice(0, 20).map((row) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        occurredAt: row.occurred_at,
        viewerExternalId: row.viewer_external_id ?? "",
        ledgerAmount: row.amount ?? "",
      })),
    );
  }

  if (projectedBalanceRows.length > 0) {
    const negativeBalances = projectedBalanceRows.filter(
      (row) =>
        row.currentBalanceAfter < 0 || row.lifetimeEarnedAfter < 0 || row.lifetimeSpentAfter < 0,
    );

    console.info("Projected balance adjustments");
    console.table(projectedBalanceRows.slice(0, 20));

    if (negativeBalances.length > 0) {
      console.warn(`Projected rollback would produce ${negativeBalances.length} negative balance fields.`);
      console.table(negativeBalances.slice(0, 20));
    }
  }

  if (offlineLinkCodeEvents.length > 0) {
    console.warn("Offline link_code_seen events need manual review; they will not be auto-rolled back.");
    console.table(
      offlineLinkCodeEvents.slice(0, 20).map((row) => ({
        eventId: row.event_id,
        occurredAt: row.occurred_at,
        viewerExternalId: row.viewer_external_id ?? "",
        extractedLinkCode: row.linkCode ?? "",
      })),
    );
  }

  if (options.dryRun) {
    console.info("Dry run complete. Re-run with --apply after reviewing the summary above.");
    return;
  }

  if (broadcastSearch.historyTruncated) {
    throw new Error("Refusing to apply cleanup because YouTube history was truncated.");
  }

  if (reviewEvents.length > 0 || intervals.unresolvedBroadcasts.length > 0) {
    throw new Error(
      "Refusing to apply cleanup because some broadcasts/events require manual review before safe deletion.",
    );
  }

  if (autoRollbackEvents.length === 0 && offlineLinkCodeEvents.length === 0) {
    console.info("No offline events require action.");
    return;
  }

  await createBackupTables(sql);

  const runId = randomUUID();
  const autoEventIds = autoRollbackEvents.map((row) => row.event_id);
  const autoLedgerEventIds = autoRollbackLedgerEvents.map((row) => row.event_id);
  const offlineLinkEventIds = offlineLinkCodeEvents.map((row) => row.event_id);
  const offlineLinkViewerExternalIds = dedupe(
    offlineLinkCodeEvents
      .map((row) => row.viewer_external_id)
      .filter((value): value is string => Boolean(value)),
  );
  const offlineLinkCodes = dedupe(
    offlineLinkCodeEvents
      .map((row) => row.linkCode)
      .filter((value): value is string => Boolean(value)),
  );
  const summaryPayload = JSON.stringify({
    ...summary,
    runId,
    offlineLinkCodesCaptured: offlineLinkCodes.length,
  });

  await sql.transaction((txn) => {
    const queries = [
      txn`
        INSERT INTO maintenance_streamerbot_cleanup_runs (run_id, applied, summary)
        VALUES (${runId}, true, ${summaryPayload})
      `,
    ];

    if (autoEventIds.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'streamerbot_event_log',
            el.id,
            el.event_id,
            NULL,
            row_to_json(el)::text
          FROM streamerbot_event_log el
          WHERE el.event_id = ANY(${autoEventIds})
        `,
      );
    }

    if (autoLedgerEventIds.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'point_ledger',
            pl.id,
            pl.external_event_id,
            pl.viewer_id,
            row_to_json(pl)::text
          FROM point_ledger pl
          WHERE pl.external_event_id = ANY(${autoLedgerEventIds})
        `,
      );
    }

    if (affectedViewerIds.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'viewer_balances_before',
            vb.viewer_id,
            NULL,
            vb.viewer_id,
            row_to_json(vb)::text
          FROM viewer_balances vb
          WHERE vb.viewer_id = ANY(${affectedViewerIds})
        `,
      );
    }

    if (offlineLinkEventIds.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_event_log',
            el.id,
            el.event_id,
            NULL,
            row_to_json(el)::text
          FROM streamerbot_event_log el
          WHERE el.event_id = ANY(${offlineLinkEventIds})
        `,
      );
    }

    if (offlineLinkViewerExternalIds.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_users',
            users.id,
            NULL,
            users.id,
            row_to_json(users)::text
          FROM users
          WHERE users.youtube_channel_id = ANY(${offlineLinkViewerExternalIds})
        `,
      );
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_balances',
            vb.viewer_id,
            NULL,
            vb.viewer_id,
            row_to_json(vb)::text
          FROM viewer_balances vb
          WHERE vb.viewer_id IN (
            SELECT id
            FROM users
            WHERE youtube_channel_id = ANY(${offlineLinkViewerExternalIds})
          )
        `,
      );
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_ledger',
            pl.id,
            pl.external_event_id,
            pl.viewer_id,
            row_to_json(pl)::text
          FROM point_ledger pl
          WHERE pl.viewer_id IN (
            SELECT id
            FROM users
            WHERE youtube_channel_id = ANY(${offlineLinkViewerExternalIds})
          )
        `,
      );
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_redemptions',
            redemptions.id,
            NULL,
            redemptions.viewer_id,
            row_to_json(redemptions)::text
          FROM redemptions
          WHERE redemptions.viewer_id IN (
            SELECT id
            FROM users
            WHERE youtube_channel_id = ANY(${offlineLinkViewerExternalIds})
          )
        `,
      );
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_bet_entries',
            bet_entries.id,
            NULL,
            bet_entries.viewer_id,
            row_to_json(bet_entries)::text
          FROM bet_entries
          WHERE bet_entries.viewer_id IN (
            SELECT id
            FROM users
            WHERE youtube_channel_id = ANY(${offlineLinkViewerExternalIds})
          )
        `,
      );
    }

    if (offlineLinkCodes.length > 0) {
      queries.push(
        txn`
          INSERT INTO maintenance_streamerbot_cleanup_backup (run_id, record_type, record_id, event_id, viewer_id, payload)
          SELECT
            ${runId},
            'link_code_seen_related_links',
            viewer_links.id,
            NULL,
            viewer_links.google_account_id,
            row_to_json(viewer_links)::text
          FROM viewer_links
          WHERE viewer_links.link_code = ANY(${offlineLinkCodes})
        `,
      );
    }

    for (const rollbackRow of rollbackByViewer) {
      queries.push(
        txn`
          UPDATE viewer_balances
          SET
            current_balance = current_balance + ${rollbackRow.currentBalanceDelta},
            lifetime_earned = lifetime_earned + ${rollbackRow.lifetimeEarnedDelta},
            lifetime_spent = lifetime_spent + ${rollbackRow.lifetimeSpentDelta},
            last_synced_at = NOW()
          WHERE viewer_id = ${rollbackRow.viewerId}
        `,
      );
    }

    if (autoLedgerEventIds.length > 0) {
      queries.push(
        txn`
          DELETE FROM point_ledger
          WHERE external_event_id = ANY(${autoLedgerEventIds})
        `,
      );
    }

    if (autoEventIds.length > 0) {
      queries.push(
        txn`
          DELETE FROM streamerbot_event_log
          WHERE event_id = ANY(${autoEventIds})
        `,
      );
    }

    return queries;
  });

  const [remainingEventLogCountRow] = (await sql`
    SELECT COUNT(*) AS count
    FROM streamerbot_event_log
    WHERE event_id = ANY(${autoEventIds.length > 0 ? autoEventIds : ["__none__"]})
  `) as Array<{ count: number | string }>;
  const [remainingLedgerCountRow] = (await sql`
    SELECT COUNT(*) AS count
    FROM point_ledger
    WHERE external_event_id = ANY(${autoLedgerEventIds.length > 0 ? autoLedgerEventIds : ["__none__"]})
  `) as Array<{ count: number | string }>;

  console.info("Apply complete.");
  console.table([
    {
      runId,
      deletedEventLogs: autoEventIds.length,
      deletedLedgerRows: autoLedgerEventIds.length,
      affectedViewers: affectedViewerIds.length,
      remainingEventLogs: Number(remainingEventLogCountRow?.count ?? 0),
      remainingLedgerRows: Number(remainingLedgerCountRow?.count ?? 0),
      offlineLinkCodeSeenPendingReview: offlineLinkCodeEvents.length,
    },
  ]);

  if (affectedViewerIds.length > 0) {
    const cleanupCandidates = await loadPostRollbackCleanupCandidates(sql, affectedViewerIds);
    const orphaned = cleanupCandidates.filter(
      (row) =>
        row.current_balance === 0 &&
        Number(row.surviving_point_entries) === 0 &&
        Number(row.redemption_count) === 0 &&
        Number(row.bet_entry_count) === 0 &&
        Number(row.link_count) === 0,
    );

    if (orphaned.length > 0) {
      console.info("Post-cleanup orphan review candidates");
      console.table(
        orphaned.map((row) => ({
          viewerId: row.viewer_id,
          youtubeDisplayName: row.youtube_display_name,
          currentBalance: row.current_balance,
        })),
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
