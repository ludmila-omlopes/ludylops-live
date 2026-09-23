import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true, env: { CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: state.env }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { creatorProfileSchema, creatorColorInk, safeCreatorColor } from "./profile";
import { getOwnedCreatorProfile, updateOwnedCreatorProfile, CreatorProfileAccessError, CreatorProfileConflictError } from "./profile.server";
import { creatorHomeLinks } from "./home";
import { defaultCreatorTenant } from "./tenant";
let id: string;
beforeEach(async () => {
  state.demo = true; state.env.CREATOR_ECONOMY_ENABLED = "true"; globalThis.__creatorTenantStore = [];
  id = (await createCreatorArea("owner", { displayName: "Canal Cristal", currencyLabel: "cristais" })).creator.id;
});
describe("owner profile", () => {
  it("updates only name/colors and preserves slug, owner, domains, modules and other branding", async () => {
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.branding.themeJson = { keep: true }; tenant.branding.logoUrl = "/logo.png";
    const snapshot = structuredClone(tenant);
    const expected = await getOwnedCreatorProfile("owner", id);
    const profile = { displayName: "Comunidade Coração", primaryColor: "#102030", accentColor: "#ffcc88" };
    expect(await updateOwnedCreatorProfile("owner", id, { profile, expected })).toEqual(profile);
    expect(tenant.creator).toMatchObject({ id, slug: snapshot.creator.slug, ownerUserId: "owner", displayName: profile.displayName, status: "active" });
    expect(tenant.modules).toEqual(snapshot.modules); expect(tenant.domains).toEqual(snapshot.domains);
    expect(tenant.branding).toMatchObject({ logoUrl: "/logo.png", themeJson: { keep: true }, fontHeading: snapshot.branding.fontHeading });
  });
  it("rejects stale edits and safely accepts a retried save", async () => {
    const expected = await getOwnedCreatorProfile("owner", id);
    const profile = { ...expected, displayName: "Nome novo" };
    await updateOwnedCreatorProfile("owner", id, { expected, profile });
    await expect(updateOwnedCreatorProfile("owner", id, { expected, profile: { ...expected, displayName: "Edição antiga" } })).rejects.toBeInstanceOf(CreatorProfileConflictError);
    expect(await updateOwnedCreatorProfile("owner", id, { expected, profile })).toEqual(profile);
  });
  it("checks ownership, scope and lifecycle, without requiring an enabled module", async () => {
    await expect(getOwnedCreatorProfile("other", id)).rejects.toBeInstanceOf(CreatorProfileAccessError);
    for (const target of ["", "missing", "creator_ludylops"]) await expect(getOwnedCreatorProfile("owner", target)).rejects.toBeInstanceOf(CreatorProfileAccessError);
    const tenant = globalThis.__creatorTenantStore![0]; tenant.modules.forEach((m) => { m.status = "disabled"; });
    expect(await getOwnedCreatorProfile("owner", id)).toHaveProperty("displayName", "Canal Cristal");
    for (const status of ["disabled", "archived"] as const) { tenant.creator.status = status; await expect(getOwnedCreatorProfile("owner", id)).rejects.toBeInstanceOf(CreatorProfileAccessError); }
  });
  it("rejects arbitrary CSS, extra fields and unavailable production storage", async () => {
    const valid = { displayName: "Nome", primaryColor: "#123456", accentColor: "#ffffff" };
    for (const primaryColor of ["red", "url(https://evil.test)", "#fff", "#000000;display:none"]) expect(creatorProfileSchema.safeParse({ ...valid, primaryColor }).success).toBe(false);
    expect(creatorProfileSchema.safeParse({ ...valid, slug: "hijacked" }).success).toBe(false);
    expect(creatorProfileSchema.safeParse({ ...valid, displayName: " ".repeat(5) }).success).toBe(false);
    state.demo = false;
    await expect(getOwnedCreatorProfile("owner", id)).rejects.toThrow("profile_storage_unavailable");
    await expect(updateOwnedCreatorProfile("owner", id, { expected: valid, profile: valid })).rejects.toThrow("profile_storage_unavailable");
  });
  it("uses readable ink for light/dark backgrounds and a safe fallback", () => {
    expect(creatorColorInk("#ffffff")).toBe("#000000"); expect(creatorColorInk("#000000")).toBe("#ffffff");
    expect(creatorColorInk("#102030")).toBe("#ffffff"); expect(creatorColorInk("#c7a2e9")).toBe("#000000");
    expect(safeCreatorColor("url(bad)", "#ffffff")).toBe("#ffffff");
  });
});
describe("usable community home links", () => {
  it("uses only isolated routes and the configured currency", () => {
    const links = creatorHomeLinks(globalThis.__creatorTenantStore![0]);
    expect(links.map((l) => l.href)).toEqual(["/c/canal-cristal/moeda", "/c/canal-cristal/ranking", "/c/canal-cristal/quotes", "/c/canal-cristal/produtinhos"]);
    expect(links[0].description).toContain("cristais");
  });
  it("hides economy links while production activation is off", () => {
    state.demo = false; state.env.CREATOR_ECONOMY_ENABLED = "false";
    expect(creatorHomeLinks(globalThis.__creatorTenantStore![0]).map((l) => l.href)).toEqual(["/c/canal-cristal/quotes", "/c/canal-cristal/produtinhos"]);
  });
  it("respects dependencies and inactive communities", () => {
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.find((m) => m.moduleKey === "streamerbot")!.status = "disabled";
    expect(creatorHomeLinks(tenant)).toHaveLength(3);
    tenant.modules.find((m) => m.moduleKey === "points")!.status = "disabled";
    expect(creatorHomeLinks(tenant).map((l) => l.href)).toEqual(["/c/canal-cristal/produtinhos"]);
    tenant.modules.forEach((m) => { m.status = "installed"; }); tenant.creator.status = "archived";
    expect(creatorHomeLinks(tenant)).toEqual([]);
  });
  it("keeps legacy links available independently of new-economy activation", () => {
    state.demo = false; state.env.CREATOR_ECONOMY_ENABLED = "false";
    expect(creatorHomeLinks(defaultCreatorTenant).map((l) => l.href)).toEqual(["/me", "/ranking", "/quotes", "/produtinhos"]);
  });
});
