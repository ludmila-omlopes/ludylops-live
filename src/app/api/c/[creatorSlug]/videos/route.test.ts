import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST } from "./route";
import { DELETE, POST as VOTE } from "./[id]/vote/route";
import { GET as OWNER_GET, PATCH as OWNER_PATCH } from "@/app/api/me/creator-area/[id]/videos/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints, listVideoSuggestions } from "@/lib/db/repository";
import { listCommunityVideos } from "@/lib/creators/videos.server";
import type { CommunityVideo } from "@/lib/creators/videos";

const host = "https://ludylops.live";
const ids = { a: "", b: "" };
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
const send = (url: string, method: string, body?: unknown, origin: string | null = host) =>
  new Request(`${host}${url}`, { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const suggest = (videoUrl: string, slug = "canal-a", extra: Record<string, unknown> = {}) =>
  POST(send(`/api/c/${slug}/videos`, "POST", { videoUrl, ...extra }), { params: Promise.resolve({ creatorSlug: slug }) });
const vote = (id: string, method: "POST" | "DELETE" = "POST", slug = "canal-a") =>
  (method === "POST" ? VOTE : DELETE)(send(`/api/c/${slug}/videos/${id}/vote`, method), { params: Promise.resolve({ creatorSlug: slug, id }) });
const owner = (creatorId: string, body?: unknown) => body === undefined
  ? OWNER_GET(send(`/api/me/creator-area/${creatorId}/videos`, "GET", undefined, null), { params: Promise.resolve({ id: creatorId }) })
  : OWNER_PATCH(send(`/api/me/creator-area/${creatorId}/videos`, "PATCH", body), { params: Promise.resolve({ id: creatorId }) });
const video = (id: string) => `https://www.youtube.com/watch?v=${id}`;

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  globalThis.__creatorTenantStore = []; globalThis.__communityVideosDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  ids.a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  ids.b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  for (const tenant of globalThis.__creatorTenantStore!) {
    tenant.modules.push({ ...tenant.modules[0], id: `${tenant.creator.id}_videos`, moduleKey: "video_suggestions" });
  }
  as("viewer_ana");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const id = new URL(new URL(String(input)).searchParams.get("url")!).searchParams.get("v");
    if (id === "missingVid0") return new Response("Not Found", { status: 404 });
    return Response.json({ title: `Vídeo ${id}`, author_name: "Canal do vídeo", thumbnail_url: "https://evil.example/thumb.jpg" });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("community videos API", () => {
  it("suggests a video with the suggester's vote and a YouTube thumbnail, only in that community", async () => {
    const response = await suggest(video("aaaaaaaaaaa"), "canal-a", { reason: "  Muito bom  " });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { data } = await response.json() as { data: CommunityVideo };
    expect(data).toMatchObject({
      title: "Vídeo aaaaaaaaaaa", channelName: "Canal do vídeo", reason: "Muito bom", status: "open", votes: 1, voted: true, suggestedBy: "Ana Neon",
      thumbnailUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg", videoUrl: video("aaaaaaaaaaa"),
    });
    expect((await listCommunityVideos(ids.a)).open.map((entry) => entry.id)).toEqual([data.id]);
    expect((await listCommunityVideos(ids.b)).open).toEqual([]);
    // Ludylops' pipetz list never sees community suggestions.
    expect((await listVideoSuggestions("viewer_ana")).some((entry) => entry.id === data.id)).toBe(false);
  });

  it("keeps one free vote per person and orders the queue by votes", async () => {
    const first = (await (await suggest(video("aaaaaaaaaaa"))).json()).data as CommunityVideo;
    const second = (await (await suggest(video("bbbbbbbbbbb"))).json()).data as CommunityVideo;
    as("viewer_caio");
    for (let i = 0; i < 2; i++) expect((await (await vote(second.id)).json()).data).toMatchObject({ votes: 2, voted: true });
    as("viewer_lia");
    expect((await (await vote(second.id)).json()).data.votes).toBe(3);
    expect((await listCommunityVideos(ids.a, "viewer_lia")).open.map((entry) => [entry.id, entry.votes, entry.voted]))
      .toEqual([[second.id, 3, true], [first.id, 1, false]]);
    for (let i = 0; i < 2; i++) expect((await (await vote(second.id, "DELETE")).json()).data).toMatchObject({ votes: 2, voted: false });
  });

  it("refuses duplicates and more than three open suggestions per person", async () => {
    expect((await suggest(video("aaaaaaaaaaa"))).status).toBe(201);
    const duplicate = await suggest("https://youtu.be/aaaaaaaaaaa");
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe("Esse vídeo já está na fila. Deixe seu voto nele.");
    // Each community keeps its own queue.
    expect((await suggest(video("aaaaaaaaaaa"), "canal-b")).status).toBe(201);
    expect((await suggest(video("bbbbbbbbbbb"))).status).toBe(201);
    expect((await suggest(video("ccccccccccc"))).status).toBe(201);
    const limited = await suggest(video("ddddddddddd"));
    expect(limited.status).toBe(409);
    expect((await limited.json()).error).toContain("3 vídeos na fila");
    as("viewer_caio");
    expect((await suggest(video("ddddddddddd"))).status).toBe(201);
  });

  it("lets only the owner move videos, and closes voting once a video leaves the queue", async () => {
    const created = (await (await suggest(video("aaaaaaaaaaa"))).json()).data as CommunityVideo;
    as("owner-b");
    expect((await owner(ids.a, { suggestionId: created.id, status: "reacted" })).status).toBe(404);
    expect((await owner(ids.a)).status).toBe(404);
    as("owner-a");
    const moved = await owner(ids.a, { suggestionId: created.id, status: "reacted" });
    expect(moved.status).toBe(200);
    expect((await moved.json()).data).toMatchObject({ id: created.id, status: "reacted", votes: 1 });
    expect((await (await owner(ids.a)).json()).data.reacted.map((entry: CommunityVideo) => entry.id)).toEqual([created.id]);
    as("viewer_caio");
    const closed = await vote(created.id);
    expect(closed.status).toBe(409);
    expect((await suggest(video("aaaaaaaaaaa"))).status).toBe(409);
    const board = await listCommunityVideos(ids.a);
    expect(board).toMatchObject({ open: [], rejected: [] });
    expect(board.reacted).toHaveLength(1);
  });

  it("hides rejected videos from the public and lets them be suggested again", async () => {
    const created = (await (await suggest(video("aaaaaaaaaaa"))).json()).data as CommunityVideo;
    as("owner-a");
    await owner(ids.a, { suggestionId: created.id, status: "rejected" });
    expect(await listCommunityVideos(ids.a)).toMatchObject({ open: [], reacted: [], rejected: [] });
    expect((await (await owner(ids.a)).json()).data.rejected).toHaveLength(1);
    as("viewer_caio");
    expect((await suggest(video("aaaaaaaaaaa"))).status).toBe(201);
  });

  it("answers 404 when the community has not turned videos on, before the session", async () => {
    globalThis.__creatorTenantStore!.find((tenant) => tenant.creator.id === ids.b)!.modules =
      globalThis.__creatorTenantStore!.find((tenant) => tenant.creator.id === ids.b)!.modules.filter((module) => module.moduleKey !== "video_suggestions");
    as(null);
    expect((await suggest(video("aaaaaaaaaaa"), "canal-b")).status).toBe(404);
    expect((await suggest(video("aaaaaaaaaaa"), "missing")).status).toBe(404);
    expect((await suggest(video("aaaaaaaaaaa"), "ludylops")).status).toBe(404);
    expect(state.session).not.toHaveBeenCalled();
  });

  it("requires a session, a trusted origin and a real YouTube video", async () => {
    as(null);
    expect((await suggest(video("aaaaaaaaaaa"))).status).toBe(401);
    expect((await vote("00000000-0000-4000-8000-000000000000")).status).toBe(401);
    as("viewer_ana");
    const forged = await POST(send("/api/c/canal-a/videos", "POST", { videoUrl: video("aaaaaaaaaaa") }, "https://attacker.example"), { params: Promise.resolve({ creatorSlug: "canal-a" }) });
    expect(forged.status).toBe(403);
    expect((await suggest("https://vimeo.com/123")).status).toBe(400);
    expect((await suggest(video("missingVid0"))).status).toBe(400);
    expect((await suggest(video("aaaaaaaaaaa"), "canal-a", { viewerId: "viewer_caio" })).status).toBe(400);
    const malformed = await POST(send("/api/c/canal-a/videos", "POST", "{"), { params: Promise.resolve({ creatorSlug: "canal-a" }) });
    expect(malformed.status).toBe(400);
    expect((await vote("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await vote("not-a-uuid")).status).toBe(404);
    expect((await listCommunityVideos(ids.a)).open).toEqual([]);
  });
});
