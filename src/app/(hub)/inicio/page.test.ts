import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), listAreas: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/creators/service", () => ({ listCreatorAreasForOwner: mocks.listAreas }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-hub" }),
  Geist_Mono: () => ({ variable: "font-hub-mono" }),
}));

import CreatorHubHomePage from "./page";

describe("creator hub home", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.listAreas.mockReset();
  });

  it("renders for visitors without loading communities", async () => {
    mocks.auth.mockResolvedValue(null);
    const markup = renderToStaticMarkup(await CreatorHubHomePage());
    expect(mocks.listAreas).not.toHaveBeenCalled();
    expect(markup).toContain('href="/criar-area"');
    expect(markup).toContain("comunidade</span>.");
    for (const id of ["recursos", "pontos", "como-funciona", "perguntas", "comecar"]) {
      expect(markup).toContain(`id="${id}"`);
    }
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).not.toMatch(/[–—]/);
  });

  it("renders for signed-in viewers without a community", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.listAreas.mockResolvedValue([]);
    expect(await CreatorHubHomePage()).toBeTruthy();
    expect(mocks.listAreas).toHaveBeenCalledWith("viewer_1", { includeArchived: true });
  });

  it("sends owners to their communities", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.listAreas.mockResolvedValue([{ id: "creator_1", slug: "canal-da-mari", status: "archived" }]);
    await expect(CreatorHubHomePage()).rejects.toThrow("NEXT_REDIRECT;/comunidades");
  });
});
