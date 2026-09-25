import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { getViewerPoints, ensureViewerFromStreamerbotIdentity, ensureViewerFromSession, adminAttachYoutubeChannelToGoogleAccount, setActiveViewerForGoogleAccount } from "@/lib/db/repository";
import { mutateCreatorEconomy, readCreatorEconomy } from "./economy";
import { mergeDemoEconomies } from "./economy-demo";
import { economyChannelMutationSchema, economyMutationSchema } from "./economy-input";

let creatorId: string, viewerId: string;
beforeEach(async () => {
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize-demo");
  viewerId = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", initializeBalance: false })).id;
  creatorId = (await createCreatorArea("owner", { displayName: "Canal A", currencyLabel: "cristais" })).creator.id;
});
const owner = { kind: "owner", viewerId: "owner" } as const;
const credit = (key: string, amount = 10) => mutateCreatorEconomy({ creatorId }, owner,
  { kind: "credit", viewerId, operationKey: key, amount, reason: "Participação na live" });
describe("creator economy contract", () => {
  it("separates currencies and retries without changing the legacy balance", async () => {
    const otherId = (await createCreatorArea("other", { displayName: "Canal B", currencyLabel: "estrelas" })).creator.id;
    const before = (await getViewerPoints(viewerId))!.balance.currentBalance;
    await credit("one"); expect((await credit("one")).duplicate).toBe(true);
    await mutateCreatorEconomy({ creatorId: otherId }, { kind: "owner", viewerId: "other" }, { kind: "credit", viewerId, operationKey: "one", amount: 30, reason: "Outra live" });
    expect((await readCreatorEconomy({ creatorId }, owner, viewerId)).balance.currentBalance).toBe(10);
    expect((await readCreatorEconomy({ creatorId: otherId }, { kind: "viewer", viewerId }, viewerId)).balance.currentBalance).toBe(30);
    expect((await getViewerPoints(viewerId))!.balance.currentBalance).toBe(before);
  });
  it("debits and refunds once, rejects overdrafts without history changes", async () => {
    await credit("one", 100);
    const debit = { kind: "debit", viewerId, operationKey: "spend", amount: 30, reason: "Recompensa" };
    const spent = await mutateCreatorEconomy({ creatorId }, owner, debit);
    await expect(mutateCreatorEconomy({ creatorId }, owner, { ...debit, operationKey: "too-much", amount: 80 })).rejects.toThrow("insufficient_balance");
    const refund = { kind: "refund", viewerId, operationKey: "refund", refundOf: spent.entry.id, reason: "Cancelamento" };
    await mutateCreatorEconomy({ creatorId }, owner, refund);
    expect((await mutateCreatorEconomy({ creatorId }, owner, refund)).duplicate).toBe(true);
    await expect(mutateCreatorEconomy({ creatorId }, owner, { ...refund, operationKey: "again" })).rejects.toThrow("already_refunded");
    const data = await readCreatorEconomy({ creatorId }, owner, viewerId);
    expect(data.balance).toEqual({ currentBalance: 100, lifetimeEarned: 100, lifetimeSpent: 0 }); expect(data.entries).toHaveLength(3);
  });
  it("moves every currency with an identity, including later retries to the old identity", async () => {
    const target = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UC1234567890123456789012", initializeBalance: false })).id;
    await credit("initial", 10); mergeDemoEconomies(viewerId, target);
    expect((await credit("initial", 10)).duplicate).toBe(true); await credit("later", 5);
    const data = await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId: target }, target);
    expect(data.viewerId).toBe(target); expect(data.balance.currentBalance).toBe(15);
  });
  it("denies wrong owners, unknown identities, disabled modules and forged body fields", async () => {
    const input = { kind: "credit", viewerId, operationKey: "x", amount: 1, reason: "x" };
    await expect(mutateCreatorEconomy({ creatorId }, { kind: "owner", viewerId: "wrong" }, input)).rejects.toThrow("economy_unavailable");
    await expect(mutateCreatorEconomy({ creatorId }, owner, { ...input, viewerId: "missing" })).rejects.toThrow("viewer_not_found");
    await expect(mutateCreatorEconomy({ creatorId }, owner, { ...input, creatorId: "other" })).rejects.toThrow();
    globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === "points")!.status = "disabled";
    await expect(credit("x")).rejects.toThrow("economy_unavailable");
  });
  it("preserves actual account-linking, session bootstrap and active-channel switching flows", async () => {
    await credit("before-link", 100);
    const first = await ensureViewerFromSession({ googleUserId: "account-google", email: "account@example.com", name: "Conta", image: null });
    const account = globalThis.__lojaDemoStore!.googleAccounts.find((a) => a.email === "account@example.com")!;
    await adminAttachYoutubeChannelToGoogleAccount({ googleAccountId: account.id, viewerId });
    expect((await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId: first!.id }, first!.id)).balance.currentBalance).toBe(100);
    const sessionInput = { googleUserId: "account-google", email: "account@example.com", name: "Conta", image: null,
      youtubeChannels: [{ youtubeChannelId: "UCabcdefghijklmnopqrstuv", youtubeDisplayName: "Canal real", youtubeHandle: null }] };
    const real = await ensureViewerFromSession(sessionInput);
    expect((await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId: real!.id }, real!.id)).balance.currentBalance).toBe(100);
    const second = await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UC1234567890123456789012", initializeBalance: false });
    await adminAttachYoutubeChannelToGoogleAccount({ googleAccountId: account.id, viewerId: second.id });
    await setActiveViewerForGoogleAccount(account.id, second.id);
    expect((await readCreatorEconomy({ creatorId }, owner, second.id)).balance.currentBalance).toBe(100);
    await setActiveViewerForGoogleAccount(account.id, real!.id);
    expect((await readCreatorEconomy({ creatorId }, owner, real!.id)).balance.currentBalance).toBe(100);
  });
  it.each([0, -1, 0.5, 1000001, Number.NaN])("rejects an invalid quantity %s", (amount) => {
    expect(economyMutationSchema.safeParse({ kind: "credit", viewerId, operationKey: "x", amount, reason: "x" }).success).toBe(false);
  });
  it("accepts channel-based input and rejects economic identity overrides", () => {
    const input = { kind: "credit", viewerExternalId: "UCabcdefghijklmnopqrstuv", operationKey: "x", amount: 5, reason: "Live" };
    expect(economyChannelMutationSchema.safeParse(input).success).toBe(true);
    expect(economyChannelMutationSchema.safeParse({ ...input, creatorId: "other" }).success).toBe(false);
    expect(economyChannelMutationSchema.safeParse({ ...input, viewerId }).success).toBe(false);
  });
});
