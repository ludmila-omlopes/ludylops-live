import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/igdb", () => ({ isIgdbConfigured: () => false, getIgdbGame: vi.fn(), searchIgdbGames: vi.fn() }));
vi.mock("@/lib/howlongtobeat", () => ({ resolveHowLongToBeatGame: vi.fn(async () => ({ match: null, fetchedAt: new Date() })) }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST } from "./route";
import { GET as REWARDS_GET, PATCH as REWARDS_PATCH } from "@/app/api/me/creator-area/[id]/page-rewards/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints } from "@/lib/db/repository";
import { readCreatorEconomy } from "@/lib/creators/economy";
import { suggestCommunityGame, updateCommunityGameStatus } from "@/lib/creators/games.server";
import { featureNewCommunityInspiration, suggestCommunityInspiration, updateCommunityInspirationStatus } from "@/lib/creators/inspirations.server";
import { createCommunityVideo, updateCommunityVideoStatus } from "@/lib/creators/videos.server";
import { startingPageRewards } from "@/lib/creators/page-rewards";
import { creatorModuleCatalog } from "@/lib/creators/modules";

const host = "https://ludylops.live";
let a = "", b = "";
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
const visit = (slug = "canal-a", origin: string | null = host) =>
  POST(new Request(`${host}/api/c/${slug}/presence`, { method: "POST", headers: origin ? { origin } : {} }), { params: Promise.resolve({ creatorSlug: slug }) });
const result = async (response: Response) => (await response.json()).data;
const balance = async (creatorId: string, viewerId: string) =>
  (await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId }, viewerId)).balance.currentBalance;
const install = (creatorId: string, moduleKey: string, configJson: Record<string, unknown> = {}) => {
  const tenant = globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === creatorId)!;
  tenant.modules.push({ ...tenant.modules[0], id: `${creatorId}_${moduleKey}`, moduleKey, configJson });
};
const points = (creatorId: string) => globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === creatorId)!.modules.find((module) => module.moduleKey === "points")!;
const rewards = (creatorId: string, method: "GET" | "PATCH", body?: unknown) =>
  (method === "GET" ? REWARDS_GET : REWARDS_PATCH)(new Request(`${host}/api/me/creator-area/${creatorId}/page-rewards`, {
    method, headers: { "content-type": "application/json", origin: host }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { params: Promise.resolve({ id: creatorId }) });

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  globalThis.__communityGamesDemo = undefined; globalThis.__communityVideosDemo = undefined; globalThis.__communityInspirationsDemo = undefined;
  await getViewerPoints("initialize");
  a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  // A fresh currency install starts with page rewards on.
  install(a, "points", { ...creatorModuleCatalog.find((module) => module.key === "points")!.defaultConfig, currencyLabel: "cristais" });
  for (const key of ["game_suggestions", "video_suggestions", "creator_suggestions"]) install(a, key);
  as("viewer_lia");
});

describe("daily visit reward", () => {
  it("credits the signed-in viewer once a day, only in that community", async () => {
    expect(startingPageRewards).toMatchObject({ presenceEnabled: true, presenceAmount: 10 });
    expect(await result(await visit())).toEqual({ credited: true, amount: 10, currencyLabel: "cristais" });
    expect(await result(await visit())).toEqual({ credited: false, amount: 10, currencyLabel: "cristais" });
    expect(await balance(a, "viewer_lia")).toBe(10);
    expect((await readCreatorEconomy({ creatorId: a }, { kind: "viewer", viewerId: "viewer_lia" }, "viewer_lia")).entries[0])
      .toMatchObject({ kind: "presence_reward", amount: 10, reason: "Visita do dia na comunidade" });
    as("viewer_caio");
    expect((await result(await visit())).credited).toBe(true);
  });

  it("respects the owner's switch and amount", async () => {
    points(a).configJson = { ...points(a).configJson, pageRewards: { ...startingPageRewards, presenceEnabled: false } };
    expect((await result(await visit())).credited).toBe(false);
    points(a).configJson = { ...points(a).configJson, pageRewards: { ...startingPageRewards, presenceAmount: 25 } };
    expect(await result(await visit())).toMatchObject({ credited: true, amount: 25 });
  });

  it("keeps an older currency without page rewards until the owner turns them on", async () => {
    points(a).configJson = { currencyLabel: "cristais" };
    expect((await result(await visit())).credited).toBe(false);
  });

  it("answers 404 without the currency, 401 without a session and 403 from another origin", async () => {
    expect((await visit("canal-b")).status).toBe(404);
    expect((await visit("ludylops")).status).toBe(404);
    as(null);
    expect((await visit()).status).toBe(401);
    as("viewer_lia");
    expect((await visit("canal-a", "https://attacker.example")).status).toBe(403);
    expect(globalThis.__creatorEconomyDemo?.entries ?? []).toEqual([]);
  });
});

describe("picked suggestion bonus", () => {
  it("credits the author once when the owner picks a game, reacts to a video or features an inspiration", async () => {
    const details = { igdbId: null, name: "Celeste", coverImageUrl: null, releaseYear: null, platforms: [], genres: [] };
    const game = await suggestCommunityGame(a, "viewer_lia", { details, reason: null, howLongToBeat: null });
    for (const status of ["accepted", "open", "accepted", "played"]) await updateCommunityGameStatus(a, "owner-a", { suggestionId: game.id, status });
    expect(await balance(a, "viewer_lia")).toBe(50);
    const video = await createCommunityVideo(a, "viewer_caio", { video: { videoId: "aaaaaaaaaaa", title: "Vídeo", creatorName: "Canal", thumbnailUrl: "", videoUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }, reason: null });
    await updateCommunityVideoStatus(a, "owner-a", { suggestionId: video.id, status: "reacted" });
    expect(await balance(a, "viewer_caio")).toBe(50);
    const inspiration = await suggestCommunityInspiration(a, "viewer_ana", { name: "Lia", channelUrl: "https://youtube.com/@lia" });
    await updateCommunityInspirationStatus(a, "owner-a", { suggestionId: inspiration.id, status: "featured" });
    expect(await balance(a, "viewer_ana")).toBe(50);
    expect((await readCreatorEconomy({ creatorId: a }, { kind: "viewer", viewerId: "viewer_ana" }, "viewer_ana")).entries[0])
      .toMatchObject({ kind: "suggestion_bonus", amount: 50, reason: "Sugestão escolhida: Lia" });
  });

  it("never pays the owner's own pick and skips communities without the currency", async () => {
    await featureNewCommunityInspiration(a, "owner-a", { name: "Caio", channelUrl: "https://twitch.tv/caio" });
    expect(globalThis.__creatorEconomyDemo?.entries ?? []).toEqual([]);
    install(b, "game_suggestions");
    const details = { igdbId: null, name: "Hades", coverImageUrl: null, releaseYear: null, platforms: [], genres: [] };
    const game = await suggestCommunityGame(b, "viewer_lia", { details, reason: null, howLongToBeat: null });
    expect(await updateCommunityGameStatus(b, "owner-b", { suggestionId: game.id, status: "accepted" })).toMatchObject({ status: "accepted" });
    expect(globalThis.__creatorEconomyDemo?.entries ?? []).toEqual([]);
  });
});

describe("owner page reward settings", () => {
  it("reads and saves only the owner's settings", async () => {
    as("owner-a");
    expect(await result(await rewards(a, "GET"))).toEqual(startingPageRewards);
    const next = { presenceEnabled: true, presenceAmount: 5, suggestionBonusEnabled: false, suggestionBonusAmount: 100 };
    expect(await result(await rewards(a, "PATCH", next))).toEqual(next);
    expect(points(a).configJson).toMatchObject({ currencyLabel: "cristais", pageRewards: next });
    expect((await rewards(a, "PATCH", { ...next, presenceAmount: 0 })).status).toBe(400);
    expect((await rewards(a, "PATCH", { ...next, extra: true })).status).toBe(400);
    as("owner-b");
    expect((await rewards(a, "GET")).status).toBe(404);
    expect((await rewards(b, "GET")).status).toBe(404);
  });
});
