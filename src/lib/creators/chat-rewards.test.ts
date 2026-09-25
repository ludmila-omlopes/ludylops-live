import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { ensureViewerFromStreamerbotIdentity, getViewerPoints } from "@/lib/db/repository";
import { rewardCreatorChat, readCreatorEconomy, mutateCreatorEconomy } from "./economy";
import { getOwnedChatRewards, updateOwnedChatRewards } from "./chat-rewards-settings.server";
import { updateOwnedCurrency } from "./currency.server";
import { getChatRewardSettings } from "./chat-rewards";
import { mergeDemoEconomies } from "./economy-demo";

let creatorId: string, viewerId: string;
const settings = { enabled: true, amount: 7, cooldownSeconds: 60 };
const reward = (messageId: string) => rewardCreatorChat({ creatorId }, { viewerId, messageId, broadcastId: "abcdefghijk" });
const read = () => readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId }, viewerId);
beforeEach(async () => {
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  viewerId = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", initializeBalance: false })).id;
  creatorId = (await createCreatorArea("owner", { displayName: "Canal A", currencyLabel: "cristais" })).creator.id;
});
afterEach(() => vi.useRealTimers());
describe("chat earning rules", () => {
  it("defaults off and preserves unrelated settings, names and another community", async () => {
    expect((await getOwnedChatRewards("owner", creatorId)).enabled).toBe(false);
    expect(getChatRewardSettings({ chatRewards: { ...settings, amount: -1 } }).enabled).toBe(false);
    const other = (await createCreatorArea("other", { displayName: "Canal B" })).creator.id;
    await updateOwnedChatRewards("owner", creatorId, settings);
    await updateOwnedCurrency("owner", creatorId, { currencyLabel: "corações" });
    expect(await getOwnedChatRewards("owner", creatorId)).toEqual(settings);
    expect((await getOwnedChatRewards("other", other)).enabled).toBe(false);
    expect((await reward("one")).currencyLabel).toBe("corações");
  });
  it("keeps paused and cooldown results stable after config edits and elapsed time", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    expect((await reward("paused")).outcome).toBe("paused");
    await updateOwnedChatRewards("owner", creatorId, settings);
    expect(await reward("paused")).toMatchObject({ outcome: "paused", duplicate: true });
    expect((await reward("first")).entry.amount).toBe(7);
    expect((await reward("fast")).outcome).toBe("cooldown");
    vi.advanceTimersByTime(60_000);
    await updateOwnedChatRewards("owner", creatorId, { ...settings, amount: 12 });
    expect(await reward("first")).toMatchObject({ duplicate: true, entry: { amount: 7 } });
    expect(await reward("fast")).toMatchObject({ duplicate: true, outcome: "cooldown" });
    expect((await reward("later")).entry.amount).toBe(12);
    expect((await read()).balance).toEqual({ currentBalance: 19, lifetimeEarned: 19, lifetimeSpent: 0 });
    expect((await read()).entries).toHaveLength(2);
  });
  it("moves cooldown and retry records with linked identities", async () => {
    await updateOwnedChatRewards("owner", creatorId, settings);
    await reward("first"); await reward("fast");
    const target = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UC1234567890123456789012", initializeBalance: false })).id;
    mergeDemoEconomies(viewerId, target);
    expect(await reward("first")).toMatchObject({ duplicate: true, entry: { viewerId: target } });
    expect((await reward("another")).outcome).toBe("cooldown");
    expect((await read()).balance.currentBalance).toBe(7);
  });
  it("rejects forged owners, legacy communities, inactive modules and reserved operation keys", async () => {
    await expect(updateOwnedChatRewards("outsider", creatorId, settings)).rejects.toThrow("Moeda indisponível");
    await expect(updateOwnedChatRewards("owner", "creator_ludylops", settings)).rejects.toThrow("Moeda indisponível");
    await expect(mutateCreatorEconomy({ creatorId }, { kind: "owner", viewerId: "owner" },
      { kind: "credit", viewerId, amount: 5, operationKey: "chat:reserved", reason: "Fake" })).rejects.toThrow();
    const integrationModule = globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === "streamerbot")!;
    integrationModule.status = "disabled";
    await expect(reward("x")).rejects.toThrow("economy_unavailable");
    expect(globalThis.__creatorEconomyDemo?.entries ?? []).toHaveLength(0);
  });
  it.each([{ ...settings, amount: 0 }, { ...settings, amount: 10001 }, { ...settings, cooldownSeconds: 9 },
    { ...settings, cooldownSeconds: 86401 }, { ...settings, enabled: "true" }, { ...settings, creatorId: "other" }])("rejects invalid settings %s", async (input) => {
    await expect(updateOwnedChatRewards("owner", creatorId, input)).rejects.toThrow();
    expect((await getOwnedChatRewards("owner", creatorId)).enabled).toBe(false);
  });
});
