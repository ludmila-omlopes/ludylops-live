import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { POST as PLACE } from "@/app/api/c/[creatorSlug]/bets/[id]/route";
import { GET as LIST, PATCH as ACT, POST as CREATE } from "@/app/api/me/creator-area/[id]/bets/route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints } from "@/lib/db/repository";
import type { CommunityBet } from "./bets";
import { CommunityBetAccessError, listCommunityBets } from "./bets.server";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { mutateCreatorEconomy, readCreatorEconomy } from "./economy";

const host = "https://ludylops.live";
let a = "", b = "";
const as = (viewerId: string | null) => state.session.mockResolvedValue(viewerId ? { user: { activeViewerId: viewerId, email: `${viewerId}@example.com` } } : null);
const json = (method: string, url: string, body: unknown, origin: string | null = host) =>
  new Request(url, { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
const owner = (handler: typeof CREATE, creatorId: string, body?: unknown, origin: string | null = host) =>
  handler(body === undefined ? new Request(`${host}/api/me/creator-area/${creatorId}/bets`) : json(handler === ACT ? "PATCH" : "POST", `${host}/api/me/creator-area/${creatorId}/bets`, body, origin),
    { params: Promise.resolve({ id: creatorId }) });
const place = (betId: string, body: unknown, slug = "canal-a", origin: string | null = host) =>
  PLACE(json("POST", `${host}/api/c/${slug}/bets/${betId}`, body, origin), { params: Promise.resolve({ creatorSlug: slug, id: betId }) });
const install = (creatorId: string, moduleKey: string, configJson: Record<string, unknown> = {}) => {
  const tenant = globalThis.__creatorTenantStore!.find((entry) => entry.creator.id === creatorId)!;
  tenant.modules.push({ ...tenant.modules[0], id: `${creatorId}_${moduleKey}`, moduleKey, configJson });
};
const balanceOf = async (viewerId: string) => (await readCreatorEconomy({ creatorId: a }, { kind: "viewer", viewerId }, viewerId)).balance.currentBalance;
const lastEntry = async (viewerId: string) => (await readCreatorEconomy({ creatorId: a }, { kind: "viewer", viewerId }, viewerId)).entries[0];
const question = "Quem vence o próximo chefe?";

async function open(options = ["Sim", "Não"]): Promise<CommunityBet> {
  as("owner-a");
  const response = await owner(CREATE, a, { question, options, closesInMinutes: 60 });
  expect(response.status).toBe(201);
  return (await response.json()).data;
}

async function bet(viewerId: string, target: CommunityBet, option: number, amount: number, placementId: string = crypto.randomUUID()) {
  as(viewerId);
  return place(target.id, { placementId, optionId: target.options[option].id, amount });
}

const act = (target: CommunityBet, body: Record<string, string>) => { as("owner-a"); return owner(ACT, a, { betId: target.id, ...body }); };

beforeEach(async () => {
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset();
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  globalThis.__communityBetsDemo = undefined;
  await getViewerPoints("initialize");
  a = (await createCreatorArea("owner-a", { displayName: "Canal A" })).creator.id;
  b = (await createCreatorArea("owner-b", { displayName: "Canal B" })).creator.id;
  install(a, "points", { currencyLabel: "cristais" });
  install(a, "bets", { minBet: 10 });
  install(b, "points", { currencyLabel: "fichas" });
  for (const viewerId of ["viewer_lia", "viewer_ana"])
    await mutateCreatorEconomy({ creatorId: a }, { kind: "owner", viewerId: "owner-a" }, { kind: "credit", viewerId, amount: 100, operationKey: `seed:${viewerId}`, reason: "Presente" });
});

describe("community bets with the community currency", () => {
  it("lets the owner open a bet and viewers bet the currency on one option", async () => {
    const created = await open();
    expect(created).toMatchObject({ question, status: "open", acceptingEntries: true, totalPool: 0, entryCount: 0, myEntry: null });
    expect(created.options.map((option) => [option.label, option.pool])).toEqual([["Sim", 0], ["Não", 0]]);

    const first = await bet("viewer_lia", created, 0, 30);
    expect(first.status).toBe(200);
    expect((await first.json()).data).toMatchObject({
      item: { totalPool: 30, entryCount: 1, myEntry: { optionId: created.options[0].id, amount: 30, payoutAmount: null, refunded: false } },
      wallet: { balance: 70, currencyLabel: "cristais" },
    });
    expect(await lastEntry("viewer_lia")).toMatchObject({ kind: "bet", amount: -30, reason: `Aposta: ${question}` });

    // Betting again adds to the same option.
    const more = await (await bet("viewer_lia", created, 0, 20)).json();
    expect(more.data).toMatchObject({ item: { totalPool: 50, entryCount: 1, myEntry: { amount: 50 } }, wallet: { balance: 50 } });
    const other = await bet("viewer_lia", created, 1, 20);
    expect(other.status).toBe(409);
    expect((await other.json()).error).toBe("Você já apostou em outra opção dessa pergunta. Só dá para aumentar a aposta na mesma opção.");
    expect(await balanceOf("viewer_lia")).toBe(50);

    const board = await listCommunityBets(a, "viewer_lia");
    expect(board).toMatchObject({ minBet: 10, finished: [] });
    expect(board.active[0]).toMatchObject({ id: created.id, totalPool: 50, myEntry: { amount: 50 } });
    expect((await listCommunityBets(a)).active[0].myEntry).toBeNull();
  });

  it("never charges twice for a repeated placement", async () => {
    const created = await open();
    const placementId = crypto.randomUUID();
    for (let i = 0; i < 3; i++) expect((await (await bet("viewer_lia", created, 0, 30, placementId)).json()).data.wallet.balance).toBe(70);
    expect((await listCommunityBets(a)).active[0].totalPool).toBe(30);
    expect((await bet("viewer_lia", created, 0, 40, placementId)).status).toBe(409);
    expect(await balanceOf("viewer_lia")).toBe(70);
  });

  it("pays the winners the whole pool, in proportion, once", async () => {
    const created = await open();
    await bet("viewer_lia", created, 0, 30);
    await bet("viewer_ana", created, 1, 60);
    const resolved = await act(created, { action: "resolve", winningOptionId: created.options[0].id });
    expect(resolved.status).toBe(200);
    expect((await resolved.json()).data).toMatchObject({ status: "resolved", winningOptionId: created.options[0].id, refunded: false, totalPool: 90 });
    expect(await balanceOf("viewer_lia")).toBe(160);
    expect(await balanceOf("viewer_ana")).toBe(40);
    expect(await lastEntry("viewer_lia")).toMatchObject({ kind: "bet_payout", amount: 90, reason: `Prêmio da aposta: ${question}` });

    const again = await act(created, { action: "resolve", winningOptionId: created.options[1].id });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe("Essa aposta já foi finalizada.");
    expect(await balanceOf("viewer_lia")).toBe(160);
    expect(await balanceOf("viewer_ana")).toBe(40);

    const board = await listCommunityBets(a, "viewer_lia");
    expect(board.active).toEqual([]);
    expect(board.finished[0]).toMatchObject({ id: created.id, myEntry: { amount: 30, payoutAmount: 90, refunded: false } });
  });

  it("refunds everyone when nobody won or the owner cancels", async () => {
    const nobody = await open();
    await bet("viewer_lia", nobody, 0, 30);
    const resolved = await (await act(nobody, { action: "resolve", winningOptionId: nobody.options[1].id })).json();
    expect(resolved.data).toMatchObject({ status: "resolved", refunded: true });
    expect(await balanceOf("viewer_lia")).toBe(100);
    expect(await lastEntry("viewer_lia")).toMatchObject({ kind: "bet_refund", amount: 30, reason: `Aposta devolvida: ${question}` });

    const cancelled = await open(["Azul", "Verde", "Roxo"]);
    await bet("viewer_ana", cancelled, 2, 20);
    expect((await (await act(cancelled, { action: "cancel" })).json()).data).toMatchObject({ status: "cancelled", refunded: true });
    expect(await balanceOf("viewer_ana")).toBe(100);
    expect((await act(cancelled, { action: "cancel" })).status).toBe(409);
    expect(await balanceOf("viewer_ana")).toBe(100);
  });

  it("stops taking bets once locked or past its time, and still resolves", async () => {
    const created = await open();
    await bet("viewer_lia", created, 0, 30);
    expect((await (await act(created, { action: "lock" })).json()).data).toMatchObject({ status: "locked", acceptingEntries: false });
    const locked = await bet("viewer_ana", created, 1, 30);
    expect(locked.status).toBe(409);
    expect((await locked.json()).error).toBe("Essa aposta não está mais aberta.");
    expect((await act(created, { action: "lock" })).status).toBe(409);
    expect((await (await act(created, { action: "resolve", winningOptionId: created.options[0].id })).json()).data.status).toBe("resolved");

    const late = await open();
    globalThis.__communityBetsDemo!.bets.find((row) => row.id === late.id)!.closesAt = new Date(Date.now() - 1000);
    expect((await listCommunityBets(a)).active[0]).toMatchObject({ id: late.id, status: "open", acceptingEntries: false });
    const closed = await bet("viewer_ana", late, 0, 30);
    expect(closed.status).toBe(409);
    expect((await closed.json()).error).toBe("As apostas para essa pergunta já foram encerradas.");
    expect(await balanceOf("viewer_ana")).toBe(100);
  });

  it("explains a bet under the minimum, a short balance and an option from another bet", async () => {
    const created = await open();
    const other = await open();
    const low = await bet("viewer_lia", created, 0, 5);
    expect(low.status).toBe(409);
    expect((await low.json()).error).toBe("Aposte pelo menos 10.");
    const short = await bet("viewer_lia", created, 0, 500);
    expect(short.status).toBe(409);
    expect((await short.json()).error).toBe("Saldo insuficiente: você tem 100 cristais.");
    as("viewer_lia");
    const foreign = await place(created.id, { placementId: crypto.randomUUID(), optionId: other.options[0].id, amount: 10 });
    expect(foreign.status).toBe(409);
    expect((await foreign.json()).error).toBe("Escolha uma das opções da aposta.");
    expect((await act(created, { action: "resolve", winningOptionId: other.options[0].id })).status).toBe(409);
    expect(await balanceOf("viewer_lia")).toBe(100);
  });

  it("lets only the owner manage bets, and only where the module is on", async () => {
    const created = await open();
    as("viewer_lia");
    expect((await owner(CREATE, a, { question, options: ["Sim", "Não"], closesInMinutes: 60 })).status).toBe(404);
    expect((await owner(ACT, a, { betId: created.id, action: "cancel" })).status).toBe(404);
    expect((await owner(LIST, a)).status).toBe(404);
    as("owner-b");
    expect((await owner(LIST, b)).status).toBe(404);
    expect((await owner(CREATE, b, { question, options: ["Sim", "Não"], closesInMinutes: 60 })).status).toBe(404);
    as("owner-a");
    const list = await owner(LIST, a);
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect((await list.json()).data.active.map((entry: CommunityBet) => entry.id)).toEqual([created.id]);

    // A community without the module answers 404 before the session; a bet of another community is unknown.
    as(null);
    state.session.mockClear();
    expect((await place(created.id, { placementId: crypto.randomUUID(), optionId: created.options[0].id, amount: 10 }, "canal-b")).status).toBe(404);
    expect(state.session).not.toHaveBeenCalled();
    install(b, "bets");
    as("viewer_lia");
    expect((await place(created.id, { placementId: crypto.randomUUID(), optionId: created.options[0].id, amount: 10 }, "canal-b")).status).toBe(404);
    expect((await place(crypto.randomUUID(), { placementId: crypto.randomUUID(), optionId: created.options[0].id, amount: 10 })).status).toBe(404);
    expect(await balanceOf("viewer_lia")).toBe(100);
    await expect(listCommunityBets(DEFAULT_CREATOR_ID)).rejects.toBeInstanceOf(CommunityBetAccessError);
  });

  it("requires a session, a trusted origin and valid input", async () => {
    const created = await open();
    const valid = { placementId: crypto.randomUUID(), optionId: created.options[0].id, amount: 10 };
    as(null);
    const anonymous = await place(created.id, valid);
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error).toBe("Entre para apostar.");
    expect((await owner(LIST, a)).status).toBe(401);
    as("viewer_lia");
    expect((await place(created.id, valid, "canal-a", "https://attacker.example")).status).toBe(403);
    for (const body of [{ ...valid, amount: 0 }, { ...valid, placementId: "nope" }, { ...valid, viewerId: "viewer_ana" }])
      expect((await place(created.id, body)).status).toBe(400);
    as("owner-a");
    expect((await owner(CREATE, a, { question, options: ["Sim", "Não"], closesInMinutes: 60 }, "https://attacker.example")).status).toBe(403);
    for (const body of [
      { question, options: ["Sim"], closesInMinutes: 60 },
      { question, options: ["Sim", "sim"], closesInMinutes: 60 },
      { question, options: ["Sim", "Não"], closesInMinutes: 1 },
      { question: "Oi", options: ["Sim", "Não"], closesInMinutes: 60 },
      { question, options: ["Sim", "Não"], closesInMinutes: 60, creatorId: b },
    ]) expect((await owner(CREATE, a, body)).status).toBe(400);
    expect((await owner(ACT, a, { betId: created.id, action: "resolve" })).status).toBe(400);
    expect(await balanceOf("viewer_lia")).toBe(100);
  });
});
