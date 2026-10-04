import type { HowLongToBeatResolution } from "@/lib/howlongtobeat";

/** Game suggestion columns for a HowLongToBeat lookup; a miss still records when it was checked. */
export function buildHowLongToBeatColumns(resolution: HowLongToBeatResolution) {
  if (!resolution.match) {
    return {
      hltbId: null,
      hltbName: null,
      hltbMainStoryMinutes: null,
      hltbMainExtraMinutes: null,
      hltbCompletionistMinutes: null,
      hltbSimilarity: null,
      hltbFetchedAt: resolution.fetchedAt,
    };
  }

  return {
    hltbId: resolution.match.id,
    hltbName: resolution.match.name,
    hltbMainStoryMinutes: resolution.match.mainStoryMinutes,
    hltbMainExtraMinutes: resolution.match.mainExtraMinutes,
    hltbCompletionistMinutes: resolution.match.completionistMinutes,
    hltbSimilarity: typeof resolution.match.similarity === "number"
      ? Math.round(resolution.match.similarity * 100)
      : null,
    hltbFetchedAt: resolution.fetchedAt,
  };
}
