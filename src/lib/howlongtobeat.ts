import type { HowLongToBeatEntry, HowLongToBeatService as HowLongToBeatServiceClass } from "howlongtobeat";

export interface HowLongToBeatMatch {
  id: string;
  name: string;
  mainStoryMinutes: number | null;
  mainExtraMinutes: number | null;
  completionistMinutes: number | null;
  similarity: number | null;
}

export interface HowLongToBeatResolution {
  match: HowLongToBeatMatch | null;
  fetchedAt: Date;
}

const MIN_RELIABLE_SIMILARITY = 0.82;
const HLTB_REQUEST_TIMEOUT_MS = 4500;

type HowLongToBeatServiceInstance = InstanceType<typeof HowLongToBeatServiceClass>;

let service: HowLongToBeatServiceInstance | null = null;

async function getService() {
  if (!service) {
    const { HowLongToBeatService } = await import("howlongtobeat");
    service = new HowLongToBeatService();
  }
  return service;
}

function normalizeGameTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hoursToMinutes(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 60)
    : null;
}

function isReliableMatch(entry: HowLongToBeatEntry, query: string) {
  const normalizedQuery = normalizeGameTitle(query);
  const normalizedName = normalizeGameTitle(entry.name);

  if (!normalizedQuery || !normalizedName) {
    return false;
  }

  if (normalizedName === normalizedQuery) {
    return true;
  }

  return entry.similarity >= MIN_RELIABLE_SIMILARITY;
}

function toMatch(entry: HowLongToBeatEntry): HowLongToBeatMatch {
  return {
    id: entry.id,
    name: entry.name,
    mainStoryMinutes: hoursToMinutes(entry.gameplayMain),
    mainExtraMinutes: hoursToMinutes(entry.gameplayMainExtra),
    completionistMinutes: hoursToMinutes(entry.gameplayCompletionist),
    similarity: typeof entry.similarity === "number" && Number.isFinite(entry.similarity)
      ? entry.similarity
      : null,
  };
}

export async function resolveHowLongToBeatGame(query: string): Promise<HowLongToBeatResolution> {
  const fetchedAt = new Date();
  const searchTerm = query.trim();

  if (searchTerm.length < 2) {
    return { match: null, fetchedAt };
  }

  try {
    const signal = AbortSignal.timeout(HLTB_REQUEST_TIMEOUT_MS);
    const results = await (await getService()).search(searchTerm, signal);
    const match = results.find(
      (entry) => isReliableMatch(entry, searchTerm) && hoursToMinutes(entry.gameplayMain) !== null,
    );

    return {
      match: match ? toMatch(match) : null,
      fetchedAt,
    };
  } catch {
    return { match: null, fetchedAt };
  }
}
