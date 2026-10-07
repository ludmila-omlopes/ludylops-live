import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST as BOOST_VIDEO } from "@/app/api/c/[creatorSlug]/videos/[id]/boost/route";
import { POST as BOOST_INSPIRATION } from "@/app/api/c/[creatorSlug]/inspirations/[id]/boost/route";
import { POST as BOOST_GAME } from "@/app/api/c/[creatorSlug]/games/[id]/boost/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints } from "@/lib/db/repository";
import { mutateCreatorEconomy, readCreatorEconomy } from "./economy";
import { readCommunityWallet } from "./community-boosts.server";
import { createCommunityVideo, listCommunityVideos, updateCommunityVideoStatus } from "./videos.server";
import { suggestCommunityInspiration, listCommunityInspirations } from "./inspirations.server";
import { suggestCommunityGame, listCommunityGames } from "./games.server";

const host = "https://ludylops.live";
let a = "", b = "";
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
type Handler = (request: Request, context: { params: Promise<{ creatorSlug: string; id: string }> }) => Promise<Response>;
const boost = (handler: Handler, path: string, id: string, body: unknown, slug = "canal-a", origin: string | null = host) =>
  handler(new Request(`${host}/api/c/${slug}/${path}/${id}/boost`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ creatorSlug: slug, id }) });
const boostId = () => crypto.randomUUID();
const install = (creatorId: string, moduleKey: string, configJson: Record<string, unknown> = {}) => {
  const tenant = globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === creatorId)!;
  tenant.modules.push({ ...tenant.modules[0], id: `${creatorId}_${moduleKey}`, moduleKey, configJson });
};
const balanceOf = async (creatorId: string, viewerId: string) => (await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId }, viewerId)).balance.currentBalance;
const video = () => createCommunityVideo(a, "viewer_ana", { video: { videoId: "aaaaaaaaaaa", title: "Vídeo legal", creatorName: "Canal", thumbnailUrl: "", videoUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }, reason: null });

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  globalThis.__communityGamesDemo = undefined; globalThis.__communityVideosDemo = undefined; globalThis.__communityInspirationsDemo = undefined;
  await getViewerPoints("initialize");
  a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  for (const creatorId of [a, b]) for (const key of ["game_suggestions", "video_suggestions", "creator_suggestions"]) install(creatorId, key);
  install(a, "points", { currencyLabel: "cristais" });
  await mutateCreatorEconomy({ creatorId: a }, { kind: "owner", viewerId: "owner-a" }, { kind: "credit", viewerId: "viewer_lia", amount: 100, operationKey: "seed", reason: "Presente" });
  as("viewer_lia");
});

describe("boosts with the community currency", () => {
  it("spends the currency, adds the amount to the votes and records a boost", async () => {
    const created = await video();
    const response = await boost(BOOST_VIDEO, "videos", created.id, { boostId: boostId(), amount: 30 });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ item: { id: created.id, votes: 31, voted: false }, wallet: { balance: 70, currencyLabel: "cristais" } });
    expect(await balanceOf(a, "viewer_lia")).toBe(70);
    expect((await readCreatorEconomy({ creatorId: a }, { kind: "viewer", viewerId: "viewer_lia" }, "viewer_lia")).entries[0])
      .toMatchObject({ kind: "boost", amount: -30, reason: "Boost: Vídeo legal" });
    expect((await listCommunityVideos(a)).open[0].votes).toBe(31);
  });

  it("never charges twice for a repeated boost", async () => {
    const created = await video();
    const id = boostId();
    for (let i = 0; i < 3; i++) expect((await (await boost(BOOST_VIDEO, "videos", created.id, { boostId: id, amount: 30 })).json()).data.wallet.balance).toBe(70);
    expect((await listCommunityVideos(a)).open[0].votes).toBe(31);
    expect((await boost(BOOST_VIDEO, "videos", created.id, { boostId: id, amount: 40 })).status).toBe(409);
  });

  it("boosts games and inspirations the same way", async () => {
    const game = await suggestCommunityGame(a, "viewer_ana", { details: { igdbId: null, name: "Celeste", coverImageUrl: null, releaseYear: null, platforms: [], genres: [] }, reason: null, howLongToBeat: null });
    const inspiration = await suggestCommunityInspiration(a, "viewer_ana", { name: "Lia", channelUrl: "https://youtube.com/@lia" });
    expect((await (await boost(BOOST_GAME, "games", game.id, { boostId: boostId(), amount: 10 })).json()).data.item.votes).toBe(11);
    expect((await (await boost(BOOST_INSPIRATION, "inspirations", inspiration.id, { boostId: boostId(), amount: 5 })).json()).data.item.votes).toBe(6);
    expect((await listCommunityGames(a)).open[0].votes).toBe(11);
    expect((await listCommunityInspirations(a)).open[0].votes).toBe(6);
    expect(await balanceOf(a, "viewer_lia")).toBe(85);
  });

  it("explains a short balance, a community without the currency and a suggestion out of the vote", async () => {
    const created = await video();
    const short = await boost(BOOST_VIDEO, "videos", created.id, { boostId: boostId(), amount: 500 });
    expect(short.status).toBe(409);
    expect((await short.json()).error).toBe("Saldo insuficiente: você tem 100 cristais.");
    const other = await createCommunityVideo(b, "viewer_ana", { video: { videoId: "bbbbbbbbbbb", title: "Outro", creatorName: "Canal", thumbnailUrl: "", videoUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb" }, reason: null });
    const noCurrency = await boost(BOOST_VIDEO, "videos", other.id, { boostId: boostId(), amount: 10 }, "canal-b");
    expect(noCurrency.status).toBe(409);
    expect((await noCurrency.json()).error).toBe("Boost indisponível nesta comunidade.");
    await updateCommunityVideoStatus(a, "owner-a", { suggestionId: created.id, status: "reacted" });
    expect((await boost(BOOST_VIDEO, "videos", created.id, { boostId: boostId(), amount: 10 })).status).toBe(409);
    expect(await balanceOf(a, "viewer_lia")).toBe(100);
  });

  it("requires a session, a trusted origin and a valid amount", async () => {
    const created = await video();
    as(null);
    expect((await boost(BOOST_VIDEO, "videos", created.id, { boostId: boostId(), amount: 10 })).status).toBe(401);
    as("viewer_lia");
    expect((await boost(BOOST_VIDEO, "videos", created.id, { boostId: boostId(), amount: 10 }, "canal-a", "https://attacker.example")).status).toBe(403);
    for (const body of [{ boostId: boostId(), amount: 0 }, { boostId: "nope", amount: 10 }, { boostId: boostId(), amount: 10, viewerId: "viewer_ana" }])
      expect((await boost(BOOST_VIDEO, "videos", created.id, body)).status).toBe(400);
    expect(await balanceOf(a, "viewer_lia")).toBe(100);
  });

  it("shows the wallet only to signed-in viewers of a community with the currency", async () => {
    const tenant = (id: string) => globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === id)!;
    expect(await readCommunityWallet(tenant(a), "viewer_lia")).toEqual({ currencyLabel: "cristais", balance: 100 });
    expect(await readCommunityWallet(tenant(a), undefined)).toBeNull();
    expect(await readCommunityWallet(tenant(b), "viewer_lia")).toBeNull();
  });
});
