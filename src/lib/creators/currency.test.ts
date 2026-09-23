import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const state = vi.hoisted(() => ({ db: vi.fn(), demo: true }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; } }));

import { currencyLabelSchema, getCurrencyLabel } from "./currency";
import { getOwnedCurrency, updateOwnedCurrency } from "./currency.server";
import { createCreatorArea } from "./service";
import { DEFAULT_CREATOR_MODULES } from "./defaults";
import { getEnabledModuleNav } from "./modules";
import { creatorModules } from "@/lib/db/schema";

beforeEach(() => {
  state.demo = true; state.db.mockReset().mockReturnValue(null);
  globalThis.__creatorTenantStore = [];
});

describe("currency identity", () => {
  it.each(["cristais", "corações", "estrelinhas", "XP", "d'ouro", "moedas-da-live"])("accepts %s", (name) => {
    expect(currencyLabelSchema.parse(name)).toBe(name);
  });
  it("normalizes Unicode and surrounding spaces", () => {
    expect(currencyLabelSchema.parse("  corac\u0327o\u0303es  ")).toBe("corações");
  });
  it.each(["", " ", "a".repeat(33), "<script>", "a\nb", "a\u202Eb", "💰", null, 1])("rejects invalid name %s", (name) => {
    expect(currencyLabelSchema.safeParse(name).success).toBe(false);
  });
  it("uses a neutral fallback and preserves Ludylops currency", () => {
    expect(getCurrencyLabel(undefined)).toBe("pontos");
    expect(getCurrencyLabel({ currencyLabel: "<invalid>" })).toBe("pontos");
    expect(getEnabledModuleNav(DEFAULT_CREATOR_MODULES).find((m) => m.key === "points")?.label).toBe("pipetz");
  });
  it("creates distinct currencies, edits only the owner's points config and preserves module status", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A", currencyLabel: "cristais" });
    const b = await createCreatorArea("owner-b", { displayName: "Canal B", currencyLabel: "estrelas" });
    const points = a.modules.find((m) => m.moduleKey === "points")!;
    points.configJson.otherSetting = { amount: 7 }; points.status = "disabled";
    const otherModules = structuredClone(a.modules.filter((m) => m.moduleKey !== "points"));
    expect(await getOwnedCurrency("owner-a", a.creator.id)).toEqual({ currencyLabel: "cristais" });
    await updateOwnedCurrency("owner-a", a.creator.id, { currencyLabel: "corações" });
    expect(await getOwnedCurrency("owner-a", a.creator.id)).toEqual({ currencyLabel: "corações" });
    expect(points.configJson).toEqual({ currencyLabel: "corações", otherSetting: { amount: 7 } });
    expect(points.status).toBe("disabled");
    expect(a.modules.filter((m) => m.moduleKey !== "points")).toEqual(otherModules);
    expect(await getOwnedCurrency("owner-b", b.creator.id)).toEqual({ currencyLabel: "estrelas" });
    expect(DEFAULT_CREATOR_MODULES.find((m) => m.moduleKey === "points")?.configJson.currencyLabel).toBe("pipetz");
  });
  it("defaults a new community to points instead of copying pipetz", async () => {
    const tenant = await createCreatorArea("owner", { displayName: "Nova Live" });
    expect(await getOwnedCurrency("owner", tenant.creator.id)).toEqual({ currencyLabel: "pontos" });
    expect(getEnabledModuleNav(tenant.modules).find((m) => m.key === "points")?.label).toBe("pontos");
  });
  it.each(["stranger", "", "owner-b"])("denies read/write to %s", async (owner) => {
    const tenant = await createCreatorArea("owner-a", { displayName: "Canal A" });
    await expect(getOwnedCurrency(owner, tenant.creator.id)).rejects.toThrow("Moeda indisponível");
    await expect(updateOwnedCurrency(owner, tenant.creator.id, { currencyLabel: "roubadas" })).rejects.toThrow("Moeda indisponível");
  });
  it.each(["disabled", "archived"] as const)("denies a %s creator", async (status) => {
    const tenant = await createCreatorArea("owner-a", { displayName: "Canal A" });
    tenant.creator.status = status;
    await expect(updateOwnedCurrency("owner-a", tenant.creator.id, { currencyLabel: "moedas" })).rejects.toThrow("Moeda indisponível");
    await expect(getOwnedCurrency("owner-a", tenant.creator.id)).rejects.toThrow("Moeda indisponível");
  });
  it("rejects missing/archived points and cannot revive them", async () => {
    const tenant = await createCreatorArea("owner-a", { displayName: "Canal A" });
    tenant.modules.find((m) => m.moduleKey === "points")!.status = "archived";
    await expect(updateOwnedCurrency("owner-a", tenant.creator.id, { currencyLabel: "moedas" })).rejects.toThrow();
    tenant.modules = [];
    await expect(updateOwnedCurrency("owner-a", tenant.creator.id, { currencyLabel: "moedas" })).rejects.toThrow();
    expect(tenant.modules).toEqual([]);
  });
  it("rejects extra mutation fields and keeps the legacy default immutable here", async () => {
    const tenant = await createCreatorArea("owner", { displayName: "Canal A" });
    await expect(updateOwnedCurrency("owner", tenant.creator.id, { currencyLabel: "x", status: "installed" })).rejects.toThrow();
    await expect(updateOwnedCurrency("owner", "creator_ludylops", { currencyLabel: "x" })).rejects.toThrow("Moeda indisponível");
  });
});

describe("currency database boundary", () => {
  it("fails closed without a database outside demo mode", async () => {
    state.demo = false;
    await expect(getOwnedCurrency("owner", "creator")).rejects.toThrow("currency_storage_unavailable");
    await expect(updateOwnedCurrency("owner", "creator", { currencyLabel: "gemas" })).rejects.toThrow("currency_storage_unavailable");
  });
  it("checks creator ownership/lifecycle inside the transaction and merges only the currency field", async () => {
    state.demo = false;
    const conditions: SQL[] = [];
    const locked = vi.fn(async () => [{ id: "creator-a" }]);
    const set = vi.fn((values: { configJson: SQL; updatedAt: Date }) => {
      void values;
      return { where: (condition: SQL) => { conditions.push(condition); return { returning: async () => [{ id: "points-a" }] }; } };
    });
    const tx = {
      select: () => ({ from: () => ({ where: (condition: SQL) => { conditions.push(condition); return { for: locked }; } }) }),
      update: vi.fn(() => ({ set })),
    };
    state.db.mockReturnValue({ transaction: async (run: (arg: typeof tx) => Promise<unknown>) => run(tx) });
    await expect(updateOwnedCurrency("owner-a", "creator-a", { currencyLabel: "corações" })).resolves.toEqual({ currencyLabel: "corações" });
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(conditions[0]).params).toEqual(["creator-a", "owner-a", "active"]);
    expect(locked).toHaveBeenCalledWith("update");
    expect(tx.update).toHaveBeenCalledWith(creatorModules);
    expect(dialect.sqlToQuery(conditions[1]).params).toEqual(["creator-a", "points", "installed", "disabled"]);
    expect(dialect.sqlToQuery(set.mock.calls[0][0].configJson)).toMatchObject({ params: [JSON.stringify({ currencyLabel: "corações" })] });
    expect(dialect.sqlToQuery(set.mock.calls[0][0].configJson).sql).toContain('"config_json" ||');
    expect(Object.keys(set.mock.calls[0][0]).sort()).toEqual(["configJson", "updatedAt"]);
    locked.mockResolvedValue([]);
    tx.update.mockClear();
    await expect(updateOwnedCurrency("outsider", "creator-a", { currencyLabel: "x" })).rejects.toThrow("Moeda indisponível");
    expect(tx.update).not.toHaveBeenCalled();
  });
});
