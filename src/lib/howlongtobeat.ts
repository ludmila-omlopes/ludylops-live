import { hltbAdapter } from "@/lib/hltb";

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

export async function resolveHowLongToBeatGame(
  query: string,
  platformName?: string | null,
): Promise<HowLongToBeatResolution> {
  const fetchedAt = new Date();
  const match = await hltbAdapter.searchBestMatch({ title: query, platformName });

  return {
    match: match
      ? {
          id: match.hltbId,
          name: match.title,
          mainStoryMinutes: match.mainStoryMinutes,
          mainExtraMinutes: match.mainExtraMinutes,
          completionistMinutes: match.completionistMinutes,
          similarity: match.score / 100,
        }
      : null,
    fetchedAt,
  };
}
