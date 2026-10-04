import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST } from "./route";
import { DELETE, POST as VOTE } from "./[id]/vote/route";
import { GET as OWNER_GET, PATCH as OWNER_PATCH, POST as OWNER_POST } from "@/app/api/me/creator-area/[id]/inspirations/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints, listCreatorSuggestions } from "@/lib/db/repository";
import { listCommunityInspirations } from "@/lib/creators/inspirations.server";
import type { CommunityInspiration } from "@/lib/creators/inspirations";

const host = "https://ludylops.live";
const ids = { a: "", b: "" };
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
const send = (url: string, method: string, body?: unknown, origin: string | null = host) =>
  new Request(`${host}${url}`, { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const creator = (name: string, channelUrl = `https://www.youtube.com/@${name}`, extra: Record<string, unknown> = {}) => ({ name, channelUrl, ...extra });
const suggest = (body: unknown, slug = "canal-a") =>
  POST(send(`/api/c/${slug}/inspirations`, "POST", body), { params: Promise.resolve({ creatorSlug: slug }) });
const vote = (id: string, method: "POST" | "DELETE" = "POST", slug = "canal-a") =>
  (method === "POST" ? VOTE : DELETE)(send(`/api/c/${slug}/inspirations/${id}/vote`, method), { params: Promise.resolve({ creatorSlug: slug, id }) });
const ownerCall = (creatorId: string, method: "GET" | "POST" | "PATCH", body?: unknown) => {
  const handler = method === "GET" ? OWNER_GET : method === "POST" ? OWNER_POST : OWNER_PATCH;
  return handler(send(`/api/me/creator-area/${creatorId}/inspirations`, method, body, method === "GET" ? null : host), { params: Promise.resolve({ id: creatorId }) });
};
const created = async (response: Response) => (await response.json()).data as CommunityInspiration;

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  globalThis.__creatorTenantStore = []; globalThis.__communityInspirationsDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  ids.a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  ids.b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  for (const tenant of globalThis.__creatorTenantStore!) {
    tenant.modules.push({ ...tenant.modules[0], id: `${tenant.creator.id}_inspirations`, moduleKey: "creator_suggestions" });
  }
  as("viewer_ana");
});

describe("community inspirations API", () => {
  it("suggests a creator with a normalized link and the suggester's vote, only in that community", async () => {
    const response = await suggest(creator("Lia", "https://www.youtube.com/@LiaPixel/?si=abc", { reason: " Edição incrível " }));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await created(response);
    expect(data).toMatchObject({ name: "Lia", channelUrl: "https://youtube.com/@LiaPixel", platform: "youtube", reason: "Edição incrível",
      status: "open", votes: 1, voted: true, suggestedBy: "Ana Neon" });
    expect((await listCommunityInspirations(ids.a)).open.map((entry) => entry.id)).toEqual([data.id]);
    expect((await listCommunityInspirations(ids.b)).open).toEqual([]);
    // Ludylops' pipetz list never sees community suggestions.
    expect((await listCreatorSuggestions("viewer_ana", { includeFeatured: true })).some((entry) => entry.id === data.id)).toBe(false);
  });

  it("keeps one free vote per person and orders the vote by votes", async () => {
    const first = await created(await suggest(creator("Um")));
    const second = await created(await suggest(creator("Dois")));
    as("viewer_caio");
    for (let i = 0; i < 2; i++) expect((await created(await vote(second.id)))).toMatchObject({ votes: 2, voted: true });
    expect((await listCommunityInspirations(ids.a, "viewer_caio")).open.map((entry) => [entry.id, entry.votes, entry.voted]))
      .toEqual([[second.id, 2, true], [first.id, 1, false]]);
    for (let i = 0; i < 2; i++) expect((await created(await vote(second.id, "DELETE")))).toMatchObject({ votes: 1, voted: false });
  });

  it("refuses duplicate links and more than three suggestions in the vote per person", async () => {
    expect((await suggest(creator("Lia", "https://youtube.com/@lia"))).status).toBe(201);
    const duplicate = await suggest(creator("Outro nome", "https://www.youtube.com/@LIA/"));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe("Esse criador já foi indicado. Deixe seu voto nele.");
    // Each community keeps its own list.
    expect((await suggest(creator("Lia", "https://youtube.com/@lia"), "canal-b")).status).toBe(201);
    expect((await suggest(creator("Dois"))).status).toBe(201);
    expect((await suggest(creator("Tres"))).status).toBe(201);
    const limited = await suggest(creator("Quatro"));
    expect(limited.status).toBe(409);
    expect((await limited.json()).error).toContain("3 indicações em votação");
    as("viewer_caio");
    expect((await suggest(creator("Quatro"))).status).toBe(201);
  });

  it("lets only the owner feature, add and move creators, and closes the vote once featured", async () => {
    const suggestion = await created(await suggest(creator("Lia")));
    as("owner-b");
    expect((await ownerCall(ids.a, "PATCH", { suggestionId: suggestion.id, status: "featured" })).status).toBe(404);
    expect((await ownerCall(ids.a, "POST", creator("Intrusa"))).status).toBe(404);
    expect((await ownerCall(ids.a, "GET")).status).toBe(404);
    as("owner-a");
    expect(await created(await ownerCall(ids.a, "PATCH", { suggestionId: suggestion.id, status: "featured" }))).toMatchObject({ status: "featured", votes: 1 });
    const added = await ownerCall(ids.a, "POST", creator("Caio", "https://twitch.tv/caio", { reason: "Meu amigo" }));
    expect(added.status).toBe(201);
    expect(await created(added)).toMatchObject({ name: "Caio", platform: "twitch", status: "featured", votes: 0, voted: false });
    expect((await ownerCall(ids.a, "POST", creator("Lia de novo", "https://youtube.com/@Lia"))).status).toBe(409);
    const board = await listCommunityInspirations(ids.a);
    expect(board.featured.map((entry) => entry.name).sort()).toEqual(["Caio", "Lia"]);
    expect(board.open).toEqual([]);
    as("viewer_caio");
    expect((await vote(suggestion.id)).status).toBe(409);
  });

  it("hides rejected creators from the public and lets them be suggested again", async () => {
    const suggestion = await created(await suggest(creator("Lia")));
    as("owner-a");
    await ownerCall(ids.a, "PATCH", { suggestionId: suggestion.id, status: "rejected" });
    expect(await listCommunityInspirations(ids.a)).toEqual({ featured: [], open: [], rejected: [] });
    expect((await (await ownerCall(ids.a, "GET")).json()).data.rejected).toHaveLength(1);
    as("viewer_caio");
    expect((await suggest(creator("Lia"))).status).toBe(201);
  });

  it("answers 404 when the community has not turned inspirations on, before the session", async () => {
    const tenant = globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === ids.b)!;
    tenant.modules = tenant.modules.filter((module) => module.moduleKey !== "creator_suggestions");
    as(null);
    expect((await suggest(creator("Lia"), "canal-b")).status).toBe(404);
    expect((await suggest(creator("Lia"), "missing")).status).toBe(404);
    expect((await suggest(creator("Lia"), "ludylops")).status).toBe(404);
    expect(state.session).not.toHaveBeenCalled();
  });

  it("requires a session, a trusted origin and a safe link", async () => {
    as(null);
    expect((await suggest(creator("Lia"))).status).toBe(401);
    expect((await vote("00000000-0000-4000-8000-000000000000")).status).toBe(401);
    as("viewer_ana");
    const forged = await POST(send("/api/c/canal-a/inspirations", "POST", creator("Lia"), "https://attacker.example"), { params: Promise.resolve({ creatorSlug: "canal-a" }) });
    expect(forged.status).toBe(403);
    expect((await suggest(creator("Lia", "javascript:alert(1)"))).status).toBe(400);
    expect((await suggest(creator("Lia", undefined, { status: "featured" }))).status).toBe(400);
    expect((await suggest(creator("Lia", undefined, { viewerId: "viewer_caio" }))).status).toBe(400);
    const malformed = await POST(send("/api/c/canal-a/inspirations", "POST", "{"), { params: Promise.resolve({ creatorSlug: "canal-a" }) });
    expect(malformed.status).toBe(400);
    expect((await vote("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await vote("not-a-uuid")).status).toBe(404);
    expect((await listCommunityInspirations(ids.a)).open).toEqual([]);
  });
});
