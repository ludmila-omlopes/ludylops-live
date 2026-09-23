import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true, env: { CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: state.env, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { ensureViewerFromStreamerbotIdentity, getViewerPoints } from "@/lib/db/repository";
import { mutateCreatorEconomy } from "./economy";
import { mergeDemoEconomies } from "./economy-demo";
import { readCreatorRanking } from "./ranking";

let a: string, b: string, viewer: string;
const credit = (creatorId: string, viewerId: string, amount: number, operationKey = viewerId) => mutateCreatorEconomy({ creatorId },
  { kind: "owner", viewerId: creatorId === a ? "owner-a" : "owner-b" }, { kind: "credit", viewerId, amount, operationKey, reason: "Privado" });
beforeEach(async () => {
  state.demo = true; state.env.CREATOR_ECONOMY_ENABLED = "true";
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  a = (await createCreatorArea("owner-a", { displayName: "Canal A", currencyLabel: "cristais" })).creator.id;
  b = (await createCreatorArea("owner-b", { displayName: "Canal B", currencyLabel: "estrelas" })).creator.id;
  viewer = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", youtubeDisplayName: "Lia", initializeBalance: false })).id;
  // A visible, linked participant. Integration-only identities remain excluded by default.
  globalThis.__lojaDemoStore!.viewers.find((v) => v.id === viewer)!.excludeFromRanking = false;
});
describe("community ranking", () => {
  it("isolates the same viewer's currencies and exposes only public fields", async () => {
    await credit(a, viewer, 10); await credit(b, viewer, 70);
    expect(await readCreatorRanking({ creatorId: a })).toEqual({ currencyLabel: "cristais", entries: [{ position: 1, displayName: "Lia", handle: null, currentBalance: 10 }] });
    expect((await readCreatorRanking({ creatorId: b })).entries[0].currentBalance).toBe(70);
    expect((await readCreatorRanking({ creatorId: a })).entries[0]).not.toHaveProperty("viewerId");
  });
  it("returns an empty ranking without adding global demo users", async () => {
    expect((await readCreatorRanking({ creatorId: a })).entries).toEqual([]);
  });
  it("excludes hidden viewers, synthetic identities and zero balances", async () => {
    await credit(a, viewer, 10);
    globalThis.__lojaDemoStore!.viewers.find((v) => v.id === viewer)!.excludeFromRanking = true;
    expect((await readCreatorRanking({ creatorId: a })).entries).toEqual([]);
    const record = globalThis.__lojaDemoStore!.viewers.find((v) => v.id === viewer)!;
    record.excludeFromRanking = false; record.youtubeChannelId = "google_synthetic";
    expect((await readCreatorRanking({ creatorId: a })).entries).toEqual([]);
    record.youtubeChannelId = "UCabcdefghijklmnopqrstuv";
    await mutateCreatorEconomy({ creatorId: a }, { kind: "owner", viewerId: "owner-a" },
      { kind: "debit", viewerId: viewer, operationKey: "debit", amount: 10, reason: "Privado" });
    expect((await readCreatorRanking({ creatorId: a })).entries).toEqual([]);
  });
  it("orders ties by channel ID and reflects an identity merge once", async () => {
    const target = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UC1234567890123456789012", youtubeDisplayName: "Bia", initializeBalance: false })).id;
    globalThis.__lojaDemoStore!.viewers.find((v) => v.id === target)!.excludeFromRanking = false;
    await credit(a, viewer, 10); await credit(a, target, 10);
    expect((await readCreatorRanking({ creatorId: a }, 1)).entries[0].displayName).toBe("Bia");
    mergeDemoEconomies(viewer, target);
    expect((await readCreatorRanking({ creatorId: a })).entries).toEqual([{ position: 1, displayName: "Bia", handle: null, currentBalance: 20 }]);
  });
  it("rechecks lifecycle/modules and rejects legacy or missing scope", async () => {
    await credit(a, viewer, 10);
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.find((m) => m.moduleKey === "ranking")!.status = "disabled";
    await expect(readCreatorRanking({ creatorId: a })).rejects.toThrow("ranking_unavailable");
    tenant.modules.find((m) => m.moduleKey === "ranking")!.status = "installed";
    tenant.creator.status = "archived";
    await expect(readCreatorRanking({ creatorId: a })).rejects.toThrow("ranking_unavailable");
    await expect(readCreatorRanking({ creatorId: "creator_ludylops" })).rejects.toThrow("ranking_unavailable");
    await expect(readCreatorRanking({ creatorId: "" })).rejects.toThrow("creator_context_required");
  });
  it.each([0, -1, 101, 1.5, NaN, Infinity, null])("does not accept unbounded or invalid limit %s", async (limit) => {
    await expect(readCreatorRanking({ creatorId: a }, limit as number)).rejects.toThrow("invalid_ranking_limit");
  });
  it("fails closed on absent production storage and the activation gate", async () => {
    state.demo = false;
    await expect(readCreatorRanking({ creatorId: a })).rejects.toThrow("ranking_storage_unavailable");
    state.env.CREATOR_ECONOMY_ENABLED = "false";
    await expect(readCreatorRanking({ creatorId: a })).rejects.toThrow("ranking_unavailable");
  });
});
