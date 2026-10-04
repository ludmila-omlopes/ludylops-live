import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn(), igdb: true, game: vi.fn(), search: vi.fn(), hltb: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/igdb", () => ({ isIgdbConfigured: () => state.igdb, getIgdbGame: state.game, searchIgdbGames: state.search }));
vi.mock("@/lib/howlongtobeat", () => ({ resolveHowLongToBeatGame: state.hltb }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST } from "./route";
import { GET as SEARCH } from "./search/route";
import { DELETE, POST as VOTE } from "./[id]/vote/route";
import { GET as OWNER_GET, PATCH as OWNER_PATCH } from "@/app/api/me/creator-area/[id]/games/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints, listGameSuggestions } from "@/lib/db/repository";
import { listCommunityGames } from "@/lib/creators/games.server";
import type { CommunityGame } from "@/lib/creators/games";

const host = "https://ludylops.live";
const ids = { a: "", b: "" };
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
const send = (url: string, method: string, body?: unknown, origin: string | null = host) =>
  new Request(`${host}${url}`, { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const suggest = (body: unknown, slug = "canal-a") => POST(send(`/api/c/${slug}/games`, "POST", body), { params: Promise.resolve({ creatorSlug: slug }) });
const search = (q: string, slug = "canal-a") => SEARCH(send(`/api/c/${slug}/games/search?q=${encodeURIComponent(q)}`, "GET", undefined, null), { params: Promise.resolve({ creatorSlug: slug }) });
const vote = (id: string, method: "POST" | "DELETE" = "POST") =>
  (method === "POST" ? VOTE : DELETE)(send(`/api/c/canal-a/games/${id}/vote`, method), { params: Promise.resolve({ creatorSlug: "canal-a", id }) });
const owner = (creatorId: string, body?: unknown) => body === undefined
  ? OWNER_GET(send(`/api/me/creator-area/${creatorId}/games`, "GET", undefined, null), { params: Promise.resolve({ id: creatorId }) })
  : OWNER_PATCH(send(`/api/me/creator-area/${creatorId}/games`, "PATCH", body), { params: Promise.resolve({ id: creatorId }) });
const data = async (response: Response) => (await response.json()).data as CommunityGame;
const igdbGame = (igdbId: number, name: string) => ({ igdbId, name, releaseYear: 2017, coverImageUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${igdbId}.jpg`, platforms: ["PC", "Switch"], genres: ["Platform"] });

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  state.igdb = true;
  state.game.mockReset().mockImplementation(async (igdbId: number) => (igdbId === 404 ? null : igdbGame(igdbId, igdbId === 7346 ? "Hollow Knight" : `Jogo ${igdbId}`)));
  state.search.mockReset().mockResolvedValue([igdbGame(7346, "Hollow Knight")]);
  state.hltb.mockReset().mockResolvedValue({ match: { id: "1", name: "Hollow Knight", mainStoryMinutes: 1620, mainExtraMinutes: null, completionistMinutes: null, similarity: 1 }, fetchedAt: new Date() });
  globalThis.__creatorTenantStore = []; globalThis.__communityGamesDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  ids.a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  ids.b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  for (const tenant of globalThis.__creatorTenantStore!) {
    tenant.modules.push({ ...tenant.modules[0], id: `${tenant.creator.id}_games`, moduleKey: "game_suggestions" });
  }
  as("viewer_ana");
});

describe("community games API", () => {
  it("searches IGDB for signed-in viewers of a community with games on", async () => {
    const response = await search("hollow");
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([igdbGame(7346, "Hollow Knight")]);
    expect((await (await search("h")).json()).data).toEqual([]);
    state.igdb = false;
    expect((await search("hollow")).status).toBe(503);
    as(null);
    expect((await search("hollow")).status).toBe(401);
    expect((await search("hollow", "missing")).status).toBe(404);
  });

  it("stores the name, cover and play time read on the server, never from the body", async () => {
    const response = await suggest({ igdbId: 7346, name: "Nome qualquer", reason: " Muito bom " });
    expect(response.status).toBe(201);
    expect(await data(response)).toMatchObject({
      name: "Hollow Knight", coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/7346.jpg", releaseYear: 2017,
      platforms: ["PC", "Switch"], mainStoryMinutes: 1620, reason: "Muito bom", status: "open", votes: 1, voted: true, suggestedBy: "Ana Neon",
    });
    expect(state.game).toHaveBeenCalledWith(7346);
    expect((await suggest({ igdbId: 7346, name: "Hollow Knight", coverImageUrl: "https://evil.example/x.jpg" })).status).toBe(400);
    expect((await suggest({ igdbId: 404, name: "Sumiu" })).status).toBe(400);
    // Ludylops' pipetz list never sees community suggestions.
    expect((await listGameSuggestions("viewer_ana")).some((entry) => entry.name === "Hollow Knight" && entry.viewerId === "viewer_ana")).toBe(false);
  });

  it("accepts a typed name when IGDB is off or the game is not listed, and survives a failed play time lookup", async () => {
    state.igdb = false;
    state.hltb.mockRejectedValue(new Error("hltb down"));
    const typed = await data(await suggest({ igdbId: 7346, name: "Jogo indie raro" }));
    expect(typed).toMatchObject({ name: "Jogo indie raro", coverImageUrl: null, mainStoryMinutes: null, platforms: [] });
    expect(state.game).not.toHaveBeenCalled();
  });

  it("refuses duplicates by IGDB ID or name and more than three games in the vote per person", async () => {
    expect((await suggest({ igdbId: 7346, name: "Hollow Knight" })).status).toBe(201);
    const duplicate = await suggest({ name: "hollow knight" });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe("Esse jogo já foi sugerido. Deixe seu voto nele.");
    expect((await suggest({ igdbId: 7346, name: "Hollow Knight" }, "canal-b")).status).toBe(201);
    expect((await suggest({ igdbId: 1, name: "Um" })).status).toBe(201);
    expect((await suggest({ igdbId: 2, name: "Dois" })).status).toBe(201);
    const limited = await suggest({ igdbId: 3, name: "Tres" });
    expect(limited.status).toBe(409);
    expect((await limited.json()).error).toContain("3 jogos em votação");
  });

  it("keeps one free vote per person, and lets only the owner pick, play and reject games", async () => {
    const game = await data(await suggest({ igdbId: 7346, name: "Hollow Knight" }));
    as("viewer_caio");
    for (let i = 0; i < 2; i++) expect(await data(await vote(game.id))).toMatchObject({ votes: 2, voted: true });
    for (let i = 0; i < 2; i++) expect(await data(await vote(game.id, "DELETE"))).toMatchObject({ votes: 1, voted: false });
    expect((await owner(ids.a, { suggestionId: game.id, status: "accepted" })).status).toBe(404);
    as("owner-b");
    expect((await owner(ids.a)).status).toBe(404);
    as("owner-a");
    expect(await data(await owner(ids.a, { suggestionId: game.id, status: "accepted" }))).toMatchObject({ status: "accepted", votes: 1 });
    expect((await listCommunityGames(ids.a)).accepted.map((entry) => entry.id)).toEqual([game.id]);
    as("viewer_caio");
    expect((await vote(game.id)).status).toBe(409);
    as("owner-a");
    await owner(ids.a, { suggestionId: game.id, status: "played" });
    expect((await listCommunityGames(ids.a)).played.map((entry) => entry.id)).toEqual([game.id]);
    as("viewer_caio");
    expect((await (await suggest({ igdbId: 7346, name: "Hollow Knight" })).json()).error).toBe("Esse jogo já foi jogado.");
    as("owner-a");
    await owner(ids.a, { suggestionId: game.id, status: "rejected" });
    expect(await listCommunityGames(ids.a)).toEqual({ accepted: [], open: [], played: [], rejected: [] });
    expect((await (await owner(ids.a)).json()).data.rejected).toHaveLength(1);
    as("viewer_caio");
    expect((await suggest({ igdbId: 7346, name: "Hollow Knight" })).status).toBe(201);
  });

  it("answers 404 when the community has not turned games on, before the session", async () => {
    const tenant = globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === ids.b)!;
    tenant.modules = tenant.modules.filter((module) => module.moduleKey !== "game_suggestions");
    as(null);
    expect((await suggest({ name: "Hollow Knight" }, "canal-b")).status).toBe(404);
    expect((await suggest({ name: "Hollow Knight" }, "ludylops")).status).toBe(404);
    expect((await search("hollow", "canal-b")).status).toBe(404);
    expect(state.session).not.toHaveBeenCalled();
    expect(state.search).not.toHaveBeenCalled();
  });

  it("requires a session and a trusted origin to write", async () => {
    as(null);
    expect((await suggest({ name: "Hollow Knight" })).status).toBe(401);
    as("viewer_ana");
    const forged = await POST(send("/api/c/canal-a/games", "POST", { name: "Hollow Knight" }, "https://attacker.example"), { params: Promise.resolve({ creatorSlug: "canal-a" }) });
    expect(forged.status).toBe(403);
    expect((await suggest({ name: "Hollow Knight", viewerId: "viewer_caio" })).status).toBe(400);
    expect((await vote("not-a-uuid")).status).toBe(404);
    expect((await listCommunityGames(ids.a)).open).toEqual([]);
  });
});
