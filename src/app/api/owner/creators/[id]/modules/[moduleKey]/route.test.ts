import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const access = vi.hoisted(() => ({ owner: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/api", () => ({
  requirePlatformOwnerApiSession: access.owner,
  isTrustedAppMutationRequest: access.origin,
  fail: (error: string, status: number) =>
    Response.json({ ok: false, error }, { status }),
  ok: (data: unknown) => Response.json({ ok: true, data }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: true }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { PATCH } from "./route";
import { defaultCreatorTenant } from "@/lib/creators/tenant";
const original = structuredClone(defaultCreatorTenant.modules);
const change = (key: string, status: string) =>
  PATCH(
    new Request("https://example.test/api/owner/creators/test/modules/test", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
    {
      params: Promise.resolve({
        id: defaultCreatorTenant.creator.id,
        moduleKey: key,
      }),
    },
  );
describe("owner module transition responses", () => {
  beforeEach(() => {
    access.owner.mockResolvedValue({ user: { id: "owner" } });
    access.origin.mockReturnValue(true);
    defaultCreatorTenant.modules = structuredClone(original);
  });
  afterEach(() => {
    defaultCreatorTenant.modules = structuredClone(original);
  });
  it("keeps owner/origin protection ahead of configuration changes", async () => {
    access.owner.mockResolvedValue(null);
    expect((await change("quotes", "disabled")).status).toBe(401);
    access.owner.mockResolvedValue({ user: { id: "owner" } });
    access.origin.mockReturnValue(false);
    expect((await change("quotes", "disabled")).status).toBe(403);
    expect(defaultCreatorTenant.modules).toEqual(original);
  });
  it("explains the rejected transition and leaves the complete configuration unchanged", async () => {
    const result = await change("points", "disabled");
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({
      error: expect.stringContaining("Desative primeiro"),
      transition: {
        allowed: false,
        blocking: expect.arrayContaining(["quotes", "bets"]),
      },
    });
    expect(defaultCreatorTenant.modules).toEqual(original);
  });
  it("allows ordered disable/enable and preserves the module configuration", async () => {
    const before = original.find((row) => row.moduleKey === "quotes")!;
    expect((await change("quotes", "disabled")).status).toBe(200);
    expect((await change("quotes", "installed")).status).toBe(200);
    expect(
      defaultCreatorTenant.modules.find((row) => row.moduleKey === "quotes"),
    ).toMatchObject({
      id: before.id,
      configJson: before.configJson,
      installedAt: before.installedAt,
    });
  });
});
