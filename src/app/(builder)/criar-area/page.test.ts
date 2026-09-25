import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), canCreate: vi.fn(), listAreas: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/creators/access", () => ({ canCreateCreatorArea: mocks.canCreate }));
vi.mock("@/lib/creators/service", () => ({ listCreatorAreasForOwner: mocks.listAreas }));

import CreateCreatorAreaPage from "./page";

describe("creator hub landing", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.canCreate.mockReset();
    mocks.listAreas.mockReset();
  });

  it("keeps the landing for visitors without loading communities", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await CreateCreatorAreaPage()).toBeTruthy();
    expect(mocks.listAreas).not.toHaveBeenCalled();
  });

  it("keeps the landing for approved viewers without a community", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.canCreate.mockResolvedValue(true);
    mocks.listAreas.mockResolvedValue([]);
    expect(await CreateCreatorAreaPage()).toBeTruthy();
    expect(mocks.listAreas).toHaveBeenCalledWith("viewer_1", { includeArchived: true });
  });

  it("sends owners to their communities", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.canCreate.mockResolvedValue(false);
    mocks.listAreas.mockResolvedValue([{ id: "creator_1", slug: "canal-da-mari", status: "archived" }]);
    await expect(CreateCreatorAreaPage()).rejects.toThrow("NEXT_REDIRECT;/comunidades");
  });
});
